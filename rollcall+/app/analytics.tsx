import { Stack } from "expo-router";
import { Dimensions, ScrollView, Text, View } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";

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

function getColor(percent: number) {
  if (percent >= 85) return "#22c55e";
  if (percent >= 75) return "#38bdf8";
  if (percent >= 65) return "#f97316";
  return "#ef4444";
}

function getLabel(percent: number) {
  if (percent >= 85) return "Excellent";
  if (percent >= 75) return "Safe";
  if (percent >= 65) return "Warning";
  return "Critical";
}

const screenWidth = Dimensions.get("window").width;

export default function Analytics() {
  const subjects = useAppStore((state) => state.attendance) as Subject[];

  const activeSubjects = subjects.filter((s) => s.total > 0);

  const totalAttended = activeSubjects.reduce(
    (sum, s) => sum + (s.attended || 0),
    0
  );

  const totalMissed = activeSubjects.reduce(
    (sum, s) => sum + (s.missed || 0),
    0
  );

  const totalClasses = activeSubjects.reduce(
    (sum, s) => sum + (s.total || 0),
    0
  );

  const overall = percentage(totalAttended, totalClasses);
  const overallColor = getColor(overall);

  const sortedSubjects = [...activeSubjects].sort(
    (a, b) => percentage(b.attended, b.total) - percentage(a.attended, a.total)
  );

  const strongest = sortedSubjects[0];
  const weakest = sortedSubjects[sortedSubjects.length - 1];

  const safeCount = activeSubjects.filter(
    (s) => percentage(s.attended, s.total) >= 75
  ).length;

  const riskCount = activeSubjects.filter(
    (s) => percentage(s.attended, s.total) < 75
  ).length;

  const chartSubjects = activeSubjects.slice(0, 6);

  const barLabels = chartSubjects.map((s) =>
    s.name.length > 7 ? s.name.slice(0, 7) : s.name
  );

  const barData = chartSubjects.map((s) => percentage(s.attended, s.total));

  const trendData = chartSubjects.map((s) => percentage(s.attended, s.total));

  const pieData = [
    {
      name: "Present",
      population: totalAttended,
      color: "#22c55e",
      legendFontColor: "#cbd5e1",
      legendFontSize: 12,
    },
    {
      name: "Missed",
      population: totalMissed,
      color: "#ef4444",
      legendFontColor: "#cbd5e1",
      legendFontSize: 12,
    },
  ];

  const disciplineScore =
    activeSubjects.length === 0 ? 0 : Math.max(0, 100 - riskCount * 12);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: "#020617" }}>
        <View style={{ padding: 20, paddingTop: 70, paddingBottom: 120 }}>
          <View style={blueGlow} />
          <View style={purpleGlow} />

          <Text style={eyebrow}>ANALYTICS 2.0</Text>

          <Text style={title}>Performance Hub</Text>

          <Text style={subtitle}>
            Attendance trends, AI insights, and subject performance analytics.
          </Text>

          <View
            style={{
              backgroundColor: "#0f172a",
              padding: 26,
              borderRadius: 36,
              marginTop: 28,
              borderWidth: 1,
              borderColor: overallColor,
              shadowColor: overallColor,
              shadowOpacity: 0.25,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text style={cardLabel}>Overall Attendance</Text>

            <Text
              style={{
                color: overallColor,
                fontSize: 64,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {overall}%
            </Text>

            <Text style={statusText}>{getLabel(overall)}</Text>

            <View style={progressTrack}>
              <View
                style={{
                  width: `${Math.min(overall, 100)}%`,
                  height: "100%",
                  backgroundColor: overallColor,
                  borderRadius: 999,
                }}
              />
            </View>

            <Text style={summaryText}>
              {riskCount > 0
                ? `${riskCount} subject${
                    riskCount > 1 ? "s" : ""
                  } currently need attention.`
                : "Attendance stability is excellent across all active subjects."}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            <StatCard title="Subjects" value={`${activeSubjects.length}`} color="#38bdf8" />
            <StatCard title="Safe" value={`${safeCount}`} color="#22c55e" />
            <StatCard title="Risk" value={`${riskCount}`} color="#ef4444" />
          </View>

          <Text style={sectionTitle}>AI Semester Insights</Text>

          <View style={summaryCard}>
            <SummaryRow
              title="Strongest Subject"
              value={
                strongest
                  ? `${strongest.name} • ${percentage(
                      strongest.attended,
                      strongest.total
                    )}%`
                  : "No data"
              }
            />

            <SummaryRow
              title="Weakest Subject"
              value={
                weakest
                  ? `${weakest.name} • ${percentage(
                      weakest.attended,
                      weakest.total
                    )}%`
                  : "No data"
              }
            />

            <SummaryRow title="Discipline Score" value={`${disciplineScore}/100`} />

            <SummaryRow
              title="Attendance Stability"
              value={
                overall >= 85
                  ? "Very Stable"
                  : overall >= 75
                  ? "Stable"
                  : overall >= 65
                  ? "Unstable"
                  : "Critical"
              }
            />
          </View>

          <Text style={sectionTitle}>Attendance Trend</Text>

          <View style={chartCard}>
            {trendData.length > 0 ? (
              <LineChart
                data={{
                  labels: barLabels,
                  datasets: [{ data: trendData }],
                }}
                width={screenWidth - 68}
                height={240}
                yAxisSuffix="%"
                chartConfig={chartConfig("#8b5cf6")}
                bezier
                style={{ borderRadius: 22 }}
              />
            ) : (
              <EmptyText text="No trend data available." />
            )}
          </View>

          <Text style={sectionTitle}>Subject Comparison</Text>

          <View style={chartCard}>
            {chartSubjects.length > 0 ? (
              <BarChart
                data={{
                  labels: barLabels,
                  datasets: [{ data: barData }],
                }}
                width={screenWidth - 68}
                height={250}
                yAxisLabel=""
                yAxisSuffix="%"
                fromZero
                chartConfig={chartConfig("#38bdf8")}
                style={{ borderRadius: 22 }}
              />
            ) : (
              <EmptyText text="No chart data available." />
            )}
          </View>

          <Text style={sectionTitle}>Attendance Distribution</Text>

          <View style={chartCard}>
            {totalClasses > 0 ? (
              <PieChart
                data={pieData}
                width={screenWidth - 68}
                height={220}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="2"
                absolute
                chartConfig={{ color: () => "#fff" }}
              />
            ) : (
              <EmptyText text="No attendance data available." />
            )}
          </View>

          <Text style={sectionTitle}>Subject Rankings</Text>

          {sortedSubjects.length === 0 ? (
            <EmptyCard text="No active subjects found yet." />
          ) : (
            sortedSubjects.map((subject, index) => {
              const percent = percentage(subject.attended, subject.total);
              const color = getColor(percent);

              return (
                <View
                  key={subject.name + index}
                  style={{
                    backgroundColor: "#0f172a",
                    padding: 20,
                    borderRadius: 30,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: color,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={rankingTitle}>
                        #{index + 1} {subject.name}
                      </Text>

                      <Text style={mutedText}>
                        {subject.attended} attended • {subject.missed} missed •{" "}
                        {subject.total} total
                      </Text>
                    </View>

                    <Text style={{ color, fontSize: 22, fontWeight: "900" }}>
                      {percent}%
                    </Text>
                  </View>

                  <View style={smallProgressTrack}>
                    <View
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        height: "100%",
                        backgroundColor: color,
                        borderRadius: 999,
                      }}
                    />
                  </View>

                  <Text style={{ color, marginTop: 12, fontWeight: "900" }}>
                    {getLabel(percent)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <BottomTabs active="analytics" />
    </>
  );
}

function chartConfig(colorValue: string) {
  return {
    backgroundColor: "#0f172a",
    backgroundGradientFrom: "#0f172a",
    backgroundGradientTo: "#0f172a",
    decimalPlaces: 0,
    color: () => colorValue,
    labelColor: () => "#cbd5e1",
    propsForDots: {
      r: "5",
      strokeWidth: "2",
      stroke: colorValue,
    },
    propsForBackgroundLines: {
      stroke: "#1e293b",
    },
  };
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <View style={statCard}>
      <Text style={statTitle}>{title}</Text>

      <Text style={{ color, fontSize: 26, fontWeight: "900", marginTop: 8 }}>
        {value}
      </Text>
    </View>
  );
}

function SummaryRow({ title, value }: { title: string; value: string }) {
  return (
    <View style={summaryRow}>
      <Text style={summaryLabel}>{title}</Text>

      <Text style={summaryValue}>{value}</Text>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return <Text style={emptyText}>{text}</Text>;
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={emptyCard}>
      <EmptyText text={text} />
    </View>
  );
}

const blueGlow = {
  position: "absolute" as const,
  width: 280,
  height: 280,
  borderRadius: 140,
  backgroundColor: "#2563eb22",
  top: -80,
  right: -120,
};

const purpleGlow = {
  position: "absolute" as const,
  width: 240,
  height: 240,
  borderRadius: 120,
  backgroundColor: "#8b5cf622",
  top: 280,
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

const statusText = {
  color: "#cbd5e1",
  fontWeight: "800" as const,
  fontSize: 17,
};

const progressTrack = {
  height: 12,
  backgroundColor: "#020617",
  borderRadius: 999,
  overflow: "hidden" as const,
  marginTop: 18,
};

const summaryText = {
  color: "#94a3b8",
  marginTop: 16,
  lineHeight: 22,
};

const sectionTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 34,
  marginBottom: 16,
};

const statCard = {
  flex: 1,
  backgroundColor: "#0f172a",
  padding: 16,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const statTitle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: "800" as const,
};

const summaryCard = {
  backgroundColor: "#0f172a",
  paddingHorizontal: 20,
  paddingVertical: 8,
  borderRadius: 30,
  borderWidth: 1,
  borderColor: "#1e293b",
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

const chartCard = {
  backgroundColor: "#0f172a",
  borderRadius: 30,
  padding: 12,
  borderWidth: 1,
  borderColor: "#1e293b",
  alignItems: "center" as const,
};

const rankingTitle = {
  color: "white",
  fontSize: 18,
  fontWeight: "900" as const,
};

const mutedText = {
  color: "#64748b",
  marginTop: 8,
};

const smallProgressTrack = {
  height: 10,
  backgroundColor: "#020617",
  borderRadius: 999,
  marginTop: 16,
  overflow: "hidden" as const,
};

const emptyText = {
  color: "#94a3b8",
  textAlign: "center" as const,
};

const emptyCard = {
  backgroundColor: "#0f172a",
  padding: 26,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: "#1e293b",
};
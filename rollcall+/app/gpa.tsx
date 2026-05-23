import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";
import { GNDU_RESULT_URL } from "../utils/api";

type ResultSubject = {
  name: string;
  code: string;
  credits: string;
  grade: string;
};

type ResultData = {
  available?: boolean;
  semester?: string;
  selected?: boolean;
  sgpa?: string;
  creditsEarned?: string;
  resultStatus?: string;
  subjects?: ResultSubject[];
};

type ManualSGPA = {
  semester: string;
  sgpa: string;
};

function getGradeColor(grade: string) {
  const g = String(grade || "").toUpperCase();

  if (g.includes("O") || g.includes("A")) return "#22c55e";
  if (g.includes("B")) return "#38bdf8";
  if (g.includes("C")) return "#f59e0b";
  return "#ef4444";
}

function getPerformanceText(score: number, hasPortalResult: boolean, hasRealSgpa: boolean) {
  if (hasPortalResult && !hasRealSgpa) return "SGPA Not Declared";
  if (score >= 9) return "Outstanding";
  if (score >= 8) return "Excellent";
  if (score >= 7) return "Very Good";
  if (score >= 6) return "Good";
  if (score > 0) return "Needs Improvement";
  return "Result Pending";
}

function isLawStudent(student: any) {
  const course = [
    student?.course,
    student?.department,
    student?.section,
    student?.batch,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  return (
    course.includes("law") ||
    course.includes("llb") ||
    course.includes("b a ll b") ||
    course.includes("ba llb") ||
    course.includes("bba llb") ||
    course.includes("b com llb") ||
    course.includes("bachelor of laws")
  );
}

function getManualStorageKey(student: any) {
  const rollNumber = String(student?.rollNumber || "").trim();
  return rollNumber ? `manualSGPA:${rollNumber}` : "manualSGPA";
}

function getGnduStorageKey(student: any) {
  const rollNumber = String(student?.rollNumber || "").trim();
  return rollNumber ? `gnduResults:${rollNumber}` : "gnduResults";
}

function getGnduRollNumber(student: any) {
  return String(
    student?.universityRollNo ||
      student?.universityRollNumber ||
      student?.rollNumber ||
      ""
  ).trim();
}

export default function GPATracker() {
  const theme = useAppTheme();
  const resultFromStore = useAppStore((state) => state.result) as ResultData | null;
  const storedResults = useAppStore((state) => state.results) as ResultData[];
  const portalResults = useMemo(
    () =>
      storedResults && storedResults.length > 0
        ? storedResults
        : resultFromStore
        ? [resultFromStore]
        : [],
    [storedResults, resultFromStore]
  );
  const student = useAppStore((state) => state.student);

  const result: ResultData = resultFromStore || {
    available: false,
    sgpa: "0",
    creditsEarned: "0",
    resultStatus: "Not Available",
    subjects: [],
  };

  const lawStudent = isLawStudent(student);
  const manualStorageKey = getManualStorageKey(student);
  const gnduStorageKey = getGnduStorageKey(student);
  const gnduRollNumber = getGnduRollNumber(student);
  const gnduRollStorageKey = `${gnduStorageKey}:roll`;

  const [semester, setSemester] = useState("");
  const [sgpaInput, setSgpaInput] = useState("");
  const [gnduRollInput, setGnduRollInput] = useState(gnduRollNumber);
  const [manualData, setManualData] = useState<ManualSGPA[]>([]);
  const [gnduResults, setGnduResults] = useState<ResultData[]>([]);
  const [gnduLoading, setGnduLoading] = useState(false);
  const [showSemesterPicker, setShowSemesterPicker] = useState(false);
  const [expandedArchiveSemester, setExpandedArchiveSemester] = useState<string | null>(
    null
  );

  const allPortalResults = [...gnduResults, ...portalResults];

  const currentPortalResult =
    gnduResults[0] ||
    resultFromStore ||
    portalResults.find((item) => item.selected) ||
    portalResults[0] ||
    result;

  const activeResult = currentPortalResult;
  const otherPortalResults = allPortalResults.filter(
    (item) =>
      (item.semester || "") !== (activeResult?.semester || "") ||
      (item.sgpa || "") !== (activeResult?.sgpa || "")
  );

  const resultSubjects = activeResult?.subjects || [];

  const hasSubjects = resultSubjects.length > 0;

  const hasRealSgpa =
    !!activeResult?.sgpa &&
    activeResult.sgpa !== "0" &&
    activeResult.sgpa !== "Not Declared" &&
    !isNaN(Number(activeResult.sgpa));

  const sgpaFromPortal = hasRealSgpa ? Number(activeResult.sgpa) : 0;

  const portalAvailable = activeResult.available === true || hasSubjects;

  const loadManualData = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(manualStorageKey);

      if (saved) {
        setManualData(JSON.parse(saved));
        return;
      }

      const legacySaved = await AsyncStorage.getItem("manualSGPA");

      if (legacySaved && manualStorageKey !== "manualSGPA") {
        setManualData(JSON.parse(legacySaved));
        await AsyncStorage.setItem(manualStorageKey, legacySaved);
        return;
      }

      setManualData([]);
    } catch (error) {
      console.log("Manual SGPA load error:", error);
    }
  }, [manualStorageKey]);

  useEffect(() => {
    loadManualData();
  }, [loadManualData]);

  const loadGnduResults = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(gnduStorageKey);
      setGnduResults(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.log("GNDU result load error:", error);
    }
  }, [gnduStorageKey]);

  useEffect(() => {
    loadGnduResults();
  }, [loadGnduResults]);

  const loadGnduRollInput = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(gnduRollStorageKey);
      setGnduRollInput(saved || gnduRollNumber);
    } catch (error) {
      console.log("GNDU roll load error:", error);
    }
  }, [gnduRollNumber, gnduRollStorageKey]);

  useEffect(() => {
    loadGnduRollInput();
  }, [loadGnduRollInput]);

  async function fetchGnduResult() {
    const rollToFetch = gnduRollInput.trim();

    if (!rollToFetch) {
      Alert.alert("GNDU Roll Number Missing", "Enter your GNDU university/exam roll number first.");
      return;
    }

    try {
      setGnduLoading(true);

      const response = await fetch(GNDU_RESULT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rollNumber: rollToFetch,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.available) {
        Alert.alert(
          "GNDU Result Not Found",
          `${data.message || "Result is not available yet."}${
            data.diagnostics
              ? `\n\nChecked: ${data.diagnostics.sessionsChecked} sessions, ${data.diagnostics.lawCoursesFound} law courses, ${data.diagnostics.semestersChecked} semesters.`
              : ""
          }${
            data.requestId ? `\n\nRequest ID: ${data.requestId}` : ""
          }`
        );
        return;
      }

      const fetchedResults = data.results || [data.current].filter(Boolean);
      setGnduResults(fetchedResults);
      await AsyncStorage.setItem(gnduRollStorageKey, rollToFetch);
      await AsyncStorage.setItem(gnduStorageKey, JSON.stringify(fetchedResults));
    } catch (error) {
      console.log("GNDU result fetch error:", error);
      Alert.alert("GNDU Result Error", "Could not connect to GNDU result portal right now.");
    } finally {
      setGnduLoading(false);
    }
  }

  async function saveManualData(data: ManualSGPA[]) {
    setManualData(data);
    await AsyncStorage.setItem(manualStorageKey, JSON.stringify(data));
  }

  async function addSGPA() {
    if (!semester.trim() || !sgpaInput.trim()) {
      Alert.alert("Missing Details", "Enter semester and SGPA");
      return;
    }

    const sgpaNumber = Number(sgpaInput);

    if (isNaN(sgpaNumber) || sgpaNumber < 0 || sgpaNumber > 10) {
      Alert.alert("Invalid SGPA", "SGPA should be between 0 and 10");
      return;
    }

    const newData = [
      ...manualData.filter(
        (item) => item.semester.toLowerCase() !== semester.trim().toLowerCase()
      ),
      {
        semester: semester.trim(),
        sgpa: sgpaInput.trim(),
      },
    ];

    await saveManualData(newData);
    setSemester("");
    setSgpaInput("");
  }

  async function deleteSGPA(index: number) {
    const updated = manualData.filter((_, i) => i !== index);
    await saveManualData(updated);
  }

  const validManualData = manualData.filter(
    (item) => !isNaN(Number(item.sgpa)) && Number(item.sgpa) > 0
  );

  const validPortalResults = (allPortalResults || []).filter(
    (item) =>
      item?.sgpa &&
      item.sgpa !== "0" &&
      item.sgpa !== "Not Declared" &&
      !isNaN(Number(item.sgpa))
  );

  const combinedSemesters = [
    ...validPortalResults.map((item) => ({
      semester: item.semester || "Portal Semester",
      sgpa: String(item.sgpa),
      source: "Portal",
    })),
    ...validManualData.map((item) => ({
      semester: item.semester,
      sgpa: item.sgpa,
      source: "Manual",
    })),
  ];

  const cgpaSemesters = lawStudent
    ? combinedSemesters
    : validPortalResults.map((item) => ({
        semester: item.semester || "Portal Semester",
        sgpa: String(item.sgpa),
        source: "Portal",
      }));

  const totalCGPA =
    cgpaSemesters.length === 0
      ? 0
      : Number(
          (
            cgpaSemesters.reduce((sum, item) => sum + Number(item.sgpa), 0) /
            cgpaSemesters.length
          ).toFixed(2)
        );
  const latestManualSemester = validManualData[validManualData.length - 1];
  const latestManualSGPA = latestManualSemester
    ? Number(latestManualSemester.sgpa)
    : 0;

  const displayScore =
    portalAvailable && hasRealSgpa
      ? sgpaFromPortal
      : lawStudent
      ? latestManualSGPA
      : 0;

  const portalMissingSgpa =
    portalAvailable && !hasRealSgpa && !(lawStudent && latestManualSGPA > 0);

  const mainScoreText = portalMissingSgpa ? "N/A" : displayScore || "0";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 68, paddingBottom: 120 }}>
          <Text style={eyebrow}>ACADEMIC PERFORMANCE</Text>

          <Text style={[title, { color: theme.text }]}>GPA & Result</Text>

          <Text style={[subtitle, { color: theme.muted }]}>
            {lawStudent
              ? "Law GPA from portal or saved SGPA"
              : "Real academic data from college portal"}
          </Text>

          <View style={[mainCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[cardLabel, { color: theme.muted }]}>
              {portalAvailable
                ? hasRealSgpa
                  ? `${activeResult?.semester || "Current"} SGPA`
                  : "Portal Result"
                : lawStudent
                ? latestManualSemester
                  ? `${latestManualSemester.semester} SGPA`
                  : "Law GPA"
                : "Portal Result"}
            </Text>

            <Text
              style={{
                color:
                  hasRealSgpa && displayScore >= 8
                    ? "#22c55e"
                    : hasRealSgpa && displayScore >= 7
                    ? "#38bdf8"
                    : portalMissingSgpa
                    ? "#f59e0b"
                    : displayScore > 0
                    ? "#f97316"
                    : "#64748b",
                fontSize: 78,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {mainScoreText}
            </Text>

            <Text style={[performanceText, { color: theme.mode === "dark" ? "#cbd5e1" : theme.muted }]}>
              {getPerformanceText(
                displayScore,
                portalAvailable && !lawStudent,
                hasRealSgpa || (lawStudent && latestManualSGPA > 0)
              )}
            </Text>

            {totalCGPA > 0 && (
              <View style={[cgpaBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Text style={{ color: theme.muted, fontWeight: "700", marginBottom: 8 }}>
                  Overall CGPA
                </Text>

                <Text style={{ color: "#22c55e", fontSize: 36, fontWeight: "900" }}>
                  {totalCGPA}
                </Text>

                <Text style={{ color: theme.subtle, marginTop: 6 }}>
                  {lawStudent
                    ? `Calculated from ${cgpaSemesters.length} portal/saved semester${
                        cgpaSemesters.length === 1 ? "" : "s"
                      }`
                    : `Calculated from ${cgpaSemesters.length} portal semester${
                        cgpaSemesters.length === 1 ? "" : "s"
                      }`}
                </Text>
              </View>
            )}

            {portalMissingSgpa && (
              <Text style={helperText}>
                Result subjects are available, but SGPA is not declared by the portal.
              </Text>
            )}

            {!portalAvailable && (
              <Text style={helperTextMuted}>
                {lawStudent
                  ? "Law portal result is not available here yet. Add your semester SGPA below and RollCall+ will calculate your GPA."
                  : "Your department result should come from AGC portal, but RollCall+ could not read it yet."}
              </Text>
            )}
          </View>

          {lawStudent && combinedSemesters.length > 0 && (
            <>
              <Text style={[sectionTitle, { color: theme.text }]}>CGPA Semesters</Text>

              {combinedSemesters.map((item, index) => (
                <View key={item.semester + index} style={[subjectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View>
                      <Text style={[subjectName, { color: theme.text }]}>{item.semester}</Text>
                      <Text style={[mutedText, { color: theme.subtle }]}>{item.source}</Text>
                    </View>

                    <Text style={manualScore}>{item.sgpa}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {portalAvailable ? (
            <>
              <View style={{ flexDirection: "row", gap: 14, marginTop: 18 }}>
                <InfoCard
                  title="Credits"
                  value={activeResult?.creditsEarned || "0"}
                  color="#38bdf8"
                />

                <InfoCard
                  title="Status"
                  value={activeResult?.resultStatus || "Pending"}
                  color="#f59e0b"
                />

                <InfoCard
                  title="Subjects"
                  value={`${resultSubjects.length}`}
                  color="#8b5cf6"
                />
              </View>

              {otherPortalResults.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    setExpandedArchiveSemester(null);
                    setShowSemesterPicker(true);
                  }}
                  style={[semesterSelector, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={{ color: theme.muted, fontWeight: "700" }}>
                    Semester Result Archive
                  </Text>

                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 18,
                      fontWeight: "900",
                      marginTop: 6,
                    }}
                  >
                    Open portal history
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={[sectionTitle, { color: theme.text }]}>Subject Grades</Text>

              {resultSubjects.length === 0 ? (
                <View style={[emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[emptyText, { color: theme.muted }]}>
                    Result page found, but subject grades are not available.
                  </Text>
                </View>
              ) : (
                resultSubjects.map((subject, index) => (
                  <View key={subject.code + index} style={[subjectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 14,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[subjectName, { color: theme.text }]}>{subject.name}</Text>

                        <Text style={[mutedText, { color: theme.subtle }]}>
                          {subject.code} • Credits: {subject.credits}
                        </Text>
                      </View>

                      <View style={[gradeBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                        <Text
                          style={{
                            color: getGradeColor(subject.grade),
                            fontSize: 22,
                            fontWeight: "900",
                          }}
                        >
                          {subject.grade}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}

          {lawStudent && (
            <>
              <Text style={[sectionTitle, { color: theme.text }]}>GNDU Result Portal</Text>

              <View style={[formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[emptyText, { color: theme.muted, textAlign: "left", marginBottom: 12 }]}>
                  Enter your GNDU university/exam roll number exactly as printed on the result portal.
                </Text>

                <TextInput
                  placeholder="GNDU roll number"
                  placeholderTextColor={theme.subtle}
                  value={gnduRollInput}
                  onChangeText={setGnduRollInput}
                  keyboardType="number-pad"
                  style={[input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.borderStrong }]}
                />

                <TouchableOpacity
                  onPress={fetchGnduResult}
                  disabled={gnduLoading}
                  style={[button, { opacity: gnduLoading ? 0.72 : 1 }]}
                >
                  <Text style={buttonText}>
                    {gnduLoading ? "Checking GNDU..." : "Fetch GNDU Result"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[sectionTitle, { color: theme.text }]}>Law Semester SGPA</Text>

              <View style={[formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[emptyText, { color: theme.muted, textAlign: "left", marginBottom: 12 }]}>
                  Add the semester SGPA from your Law/GNDU result. The latest saved semester appears in the main card and all saved semesters build your CGPA.
                </Text>

                <TextInput
                  placeholder="Semester e.g. Sem 2"
                  placeholderTextColor={theme.subtle}
                  value={semester}
                  onChangeText={setSemester}
                  style={[input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.borderStrong }]}
                />

                <TextInput
                  placeholder="SGPA e.g. 8.2"
                  placeholderTextColor={theme.subtle}
                  value={sgpaInput}
                  onChangeText={setSgpaInput}
                  keyboardType="decimal-pad"
                  style={[input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.borderStrong }]}
                />

                <TouchableOpacity onPress={addSGPA} style={button}>
                  <Text style={buttonText}>Save SGPA</Text>
                </TouchableOpacity>
              </View>

              <Text style={[sectionTitle, { color: theme.text }]}>Manual Semester History</Text>

              {manualData.length === 0 ? (
                <View style={[emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[emptyText, { color: theme.muted }]}>
                    No manual SGPA added yet. Add older or missing semesters here.
                  </Text>
                </View>
              ) : (
                manualData.map((item, index) => (
                  <View key={item.semester + index} style={[subjectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View>
                        <Text style={[subjectName, { color: theme.text }]}>{item.semester}</Text>
                        <Text style={[mutedText, { color: theme.subtle }]}>Saved manually</Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={manualScore}>{item.sgpa}</Text>

                        <TouchableOpacity onPress={() => deleteSGPA(index)}>
                          <Text style={deleteText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={showSemesterPicker} animationType="slide">
        <Pressable
          onPress={() => setShowSemesterPicker(false)}
          style={{
            flex: 1,
            backgroundColor: theme.backdrop,
            justifyContent: "flex-end",
          }}
        >
          <Pressable style={[modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={modalHandle} />

            <Text style={[modalTitle, { color: theme.text }]}>Portal Semester Results</Text>

              <FlatList
                data={otherPortalResults}
                keyExtractor={(item, index) => `${item.semester || "sem"}-${index}`}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={5}
                style={{ maxHeight: 560 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => {
                  const archiveKey = `${item.semester || "sem"}-${index}`;
                  const expanded = expandedArchiveSemester === archiveKey;
                  const subjects = item.subjects || [];

                  return (
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() =>
                        setExpandedArchiveSemester(expanded ? null : archiveKey)
                      }
                      style={[modalItem, { backgroundColor: theme.input, borderColor: theme.border }]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 14,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>
                            {item.semester || `Semester ${index + 1}`}
                          </Text>

                          <Text style={{ color: theme.muted, marginTop: 6 }}>
                            {item.resultStatus || "Pending"} • Credits:{" "}
                            {item.creditsEarned || "0"} • {subjects.length} subjects
                          </Text>
                        </View>

                        <Text style={manualScore}>{item.sgpa || "N/A"}</Text>
                      </View>

                      {expanded &&
                        subjects.map((subject, subjectIndex) => (
                          <View
                            key={subject.code + subjectIndex}
                            style={{
                              borderTopWidth: 1,
                              borderTopColor: theme.border,
                              marginTop: 14,
                              paddingTop: 14,
                              flexDirection: "row",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.mode === "dark" ? "#e2e8f0" : theme.text, fontWeight: "800" }}>
                                {subject.name}
                              </Text>

                              <Text style={{ color: theme.subtle, marginTop: 4 }}>
                                {subject.code} • Credits: {subject.credits}
                              </Text>
                            </View>

                            <Text
                              style={{
                                color: getGradeColor(subject.grade),
                                fontSize: 18,
                                fontWeight: "900",
                              }}
                            >
                              {subject.grade}
                            </Text>
                          </View>
                        ))}
                    </TouchableOpacity>
                  );
                }}
              />
          </Pressable>
        </Pressable>
      </Modal>

      <BottomTabs active="gpa" />
    </>
  );
}

function InfoCard({ title, value, color }: { title: string; value: string; color: string }) {
  const theme = useAppTheme();

  return (
    <View style={[infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[infoTitle, { color: theme.muted }]}>{title}</Text>

      <Text numberOfLines={1} style={{ color, fontSize: 20, fontWeight: "900", marginTop: 10 }}>
        {value}
      </Text>
    </View>
  );
}

const eyebrow = {
  color: "#a78bfa",
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
};

const mainCard = {
  backgroundColor: "#0f172a",
  padding: 30,
  borderRadius: 36,
  marginTop: 30,
  borderWidth: 1,
  borderColor: "#1e293b",
  shadowColor: "#8b5cf6",
  shadowOpacity: 0.25,
  shadowRadius: 20,
  elevation: 10,
};

const cgpaBox = {
  marginTop: 18,
  backgroundColor: "#111827",
  borderRadius: 22,
  padding: 18,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const cardLabel = {
  color: "#94a3b8",
  fontSize: 16,
  fontWeight: "700" as const,
};

const performanceText = {
  color: "#cbd5e1",
  fontSize: 18,
  fontWeight: "700" as const,
};

const helperText = {
  color: "#94a3b8",
  marginTop: 14,
  lineHeight: 21,
};

const helperTextMuted = {
  color: "#64748b",
  marginTop: 14,
  lineHeight: 21,
};

const sectionTitle = {
  color: "white",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 34,
  marginBottom: 16,
};

const semesterSelector = {
  backgroundColor: "#0f172a",
  borderRadius: 22,
  padding: 16,
  marginTop: 16,
  marginBottom: 18,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const infoCard = {
  flex: 1,
  backgroundColor: "#0f172a",
  padding: 16,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const infoTitle = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: "800" as const,
};

const subjectCard = {
  backgroundColor: "#0f172a",
  padding: 22,
  borderRadius: 28,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const subjectName = {
  color: "white",
  fontSize: 18,
  fontWeight: "900" as const,
};

const mutedText = {
  color: "#64748b",
  marginTop: 8,
};

const gradeBox = {
  backgroundColor: "#111827",
  paddingHorizontal: 18,
  paddingVertical: 12,
  borderRadius: 18,
  alignSelf: "flex-start" as const,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const formCard = {
  backgroundColor: "#0f172a",
  padding: 20,
  borderRadius: 28,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const input = {
  backgroundColor: "#020617",
  color: "white",
  padding: 16,
  borderRadius: 18,
  marginBottom: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: "#334155",
};

const button = {
  backgroundColor: "#7c3aed",
  padding: 17,
  borderRadius: 20,
  alignItems: "center" as const,
};

const buttonText = {
  color: "white",
  fontWeight: "900" as const,
  fontSize: 16,
};

const manualScore = {
  color: "#22c55e",
  fontSize: 26,
  fontWeight: "900" as const,
};

const deleteText = {
  color: "#ef4444",
  marginTop: 8,
  fontWeight: "900" as const,
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
};

const modalBox = {
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
  marginBottom: 16,
};

const modalItem = {
  backgroundColor: "#020617",
  borderRadius: 22,
  padding: 18,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#1e293b",
};

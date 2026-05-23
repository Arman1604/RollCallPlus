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
  source?: string;
  sgpa?: string;
  creditsEarned?: string;
  resultStatus?: string;
  subjects?: ResultSubject[];
};

type GnduDropdownKey = "year" | "month" | "courseType" | "semester";

type GnduOption = {
  label: string;
  value: string;
};

function getGradeColor(grade: string) {
  const g = String(grade || "").toUpperCase();
  const numericGrade = Number(g);

  if (!isNaN(numericGrade)) {
    if (numericGrade >= 75) return "#22c55e";
    if (numericGrade >= 60) return "#38bdf8";
    if (numericGrade >= 50) return "#f59e0b";
    return "#ef4444";
  }

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

function getCompactSemesterTitle(value?: string) {
  const title = String(value || "Semester")
    .replace(/\s*\(FIVE YEARS INTEGRATED COURSE\)/i, "")
    .replace(/,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || "Semester";
}

function getResultHistoryKey(result: ResultData) {
  return [
    result.source || "Portal",
    getCompactSemesterTitle(result.semester),
  ]
    .join(":")
    .toLowerCase();
}

function mergeResultHistory(existing: ResultData[], incoming: ResultData[]) {
  const merged = new Map<string, ResultData>();

  [...incoming, ...existing].forEach((item) => {
    if (!item) return;
    const key = getResultHistoryKey(item);

    if (!merged.has(key)) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values());
}

const GNDU_YEAR_OPTIONS = ["2026", "2025", "2024", "2023"].map((year) => ({
  label: year,
  value: year,
}));

const GNDU_MONTH_OPTIONS = [
  { label: "April", value: "4" },
  { label: "May", value: "5" },
  { label: "September", value: "9" },
  { label: "December", value: "12" },
];

const GNDU_COURSE_TYPE_OPTIONS = [
  { label: "Pass Course", value: "P" },
  { label: "College Course", value: "C-" },
];

const GNDU_SEMESTERS = [
  { label: "Sem I", suffix: "01" },
  { label: "Sem II", suffix: "02" },
  { label: "Sem III", suffix: "03" },
  { label: "Sem IV", suffix: "04" },
  { label: "Sem V", suffix: "05" },
  { label: "Sem VI", suffix: "06" },
  { label: "Sem VII", suffix: "07" },
  { label: "Sem VIII", suffix: "08" },
  { label: "Sem IX", suffix: "09" },
  { label: "Sem X", suffix: "10" },
];

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
  const gnduStorageKey = getGnduStorageKey(student);
  const gnduRollNumber = getGnduRollNumber(student);
  const gnduRollStorageKey = `${gnduStorageKey}:roll`;

  const [gnduRollInput, setGnduRollInput] = useState(gnduRollNumber);
  const [gnduYearInput, setGnduYearInput] = useState("2025");
  const [gnduMonthInput, setGnduMonthInput] = useState("12");
  const [gnduCourseTypeInput, setGnduCourseTypeInput] = useState("P");
  const [gnduSemesterCodeInput, setGnduSemesterCodeInput] = useState("112403");
  const [gnduResults, setGnduResults] = useState<ResultData[]>([]);
  const [gnduLoading, setGnduLoading] = useState(false);
  const [openGnduDropdown, setOpenGnduDropdown] =
    useState<GnduDropdownKey | null>(null);
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
  const isGnduResult = activeResult?.source === "GNDU";
  const inferredGnduCourseCode = gnduRollInput.trim().slice(0, 4) || "1124";
  const gnduSemesterOptions = useMemo(
    () =>
      GNDU_SEMESTERS.map((item) => ({
        ...item,
        value: `${inferredGnduCourseCode}${item.suffix}`,
      })),
    [inferredGnduCourseCode]
  );
  const selectedGnduMonth =
    GNDU_MONTH_OPTIONS.find((item) => item.value === gnduMonthInput)?.label ||
    gnduMonthInput;
  const selectedGnduCourseType =
    GNDU_COURSE_TYPE_OPTIONS.find((item) => item.value === gnduCourseTypeInput)
      ?.label || gnduCourseTypeInput;
  const selectedGnduSemester =
    gnduSemesterOptions.find((item) => item.value === gnduSemesterCodeInput)
      ?.label || gnduSemesterCodeInput;
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
          year: gnduYearInput.trim(),
          month: gnduMonthInput.trim(),
          courseType: gnduCourseTypeInput.trim(),
          courseCode: inferredGnduCourseCode,
          semesterCode: gnduSemesterCodeInput.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.available) {
        Alert.alert(
          "GNDU Result Not Found",
          `${data.message || "Result is not available yet."}${
            data.error ? `\n\nError: ${data.error}` : ""
          }${
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
      const savedResults = await AsyncStorage.getItem(gnduStorageKey);
      const existingResults = savedResults ? JSON.parse(savedResults) : gnduResults;
      const mergedResults = mergeResultHistory(existingResults, fetchedResults);

      setGnduResults(mergedResults);
      await AsyncStorage.setItem(gnduRollStorageKey, rollToFetch);
      await AsyncStorage.setItem(gnduStorageKey, JSON.stringify(mergedResults));
    } catch (error) {
      console.log("GNDU result fetch error:", error);
      Alert.alert("GNDU Result Error", "Could not connect to GNDU result portal right now.");
    } finally {
      setGnduLoading(false);
    }
  }

  const validPortalResults = (allPortalResults || []).filter(
    (item) =>
      item?.sgpa &&
      item.sgpa !== "0" &&
      item.sgpa !== "Not Declared" &&
      !isNaN(Number(item.sgpa))
  );

  const cgpaSemesters = validPortalResults.map((item) => ({
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
  const displayScore = portalAvailable && hasRealSgpa ? sgpaFromPortal : 0;

  const portalMissingSgpa = portalAvailable && !hasRealSgpa;

  const mainScoreText = portalMissingSgpa ? "N/A" : displayScore || "0";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ padding: 20, paddingTop: 68, paddingBottom: 190 }}>
          <Text style={eyebrow}>ACADEMIC PERFORMANCE</Text>

          <Text style={[title, { color: theme.text }]}>GPA & Result</Text>

          <Text style={[subtitle, { color: theme.muted }]}>
            {lawStudent
              ? "Law GPA from GNDU portal results"
              : "Real academic data from college portal"}
          </Text>

          <View style={[mainCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[cardLabel, { color: theme.muted }]}>
              {portalAvailable
                ? hasRealSgpa
                  ? `${getCompactSemesterTitle(activeResult?.semester || "Current")} SGPA`
                  : "Portal Result"
                : lawStudent
                ? "Law GPA"
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
                hasRealSgpa
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
                    ? `Calculated from ${cgpaSemesters.length} portal semester${
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
                  ? "Fetch your Law result from the GNDU portal below."
                  : "Your department result should come from AGC portal, but RollCall+ could not read it yet."}
              </Text>
            )}
          </View>

          {lawStudent && cgpaSemesters.length > 0 && (
            <>
              <Text style={[sectionTitle, { color: theme.text }]}>CGPA Semesters</Text>

              {cgpaSemesters.map((item, index) => (
                <View key={item.semester + index} style={[subjectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={semesterResultRow}>
                    <View style={semesterResultInfo}>
                      <Text numberOfLines={3} style={[semesterResultTitle, { color: theme.text }]}>
                        {getCompactSemesterTitle(item.semester)}
                      </Text>
                      <Text style={[mutedText, { color: theme.subtle }]}>{item.source}</Text>
                    </View>

                    <View style={[semesterScoreBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                      <Text style={semesterScoreText}>{item.sgpa}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {portalAvailable ? (
            <>
              <View style={{ flexDirection: "row", gap: 14, marginTop: 18 }}>
                <InfoCard
                  title={isGnduResult ? "Marks" : "Credits"}
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
                          {isGnduResult
                            ? `${subject.code} - Marks: ${subject.grade}/${subject.credits}`
                            : `${subject.code} - Credits: ${subject.credits}`}
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
                  Use your GNDU university/exam roll number.
                </Text>

                <TextInput
                  placeholder="GNDU roll number"
                  placeholderTextColor={theme.subtle}
                  value={gnduRollInput}
                  onChangeText={setGnduRollInput}
                  keyboardType="number-pad"
                  style={[input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.borderStrong }]}
                />

                <Text style={[gnduHelpLine, { color: theme.subtle }]}>
                  Pick result year, exam session, course type, and semester. No date needed.
                </Text>

                <View style={dropdownGrid}>
                  <View style={dropdownGridItem}>
                    <GnduDropdown
                      label="Year"
                      options={GNDU_YEAR_OPTIONS}
                      value={gnduYearInput}
                      open={openGnduDropdown === "year"}
                      onToggle={() =>
                        setOpenGnduDropdown(openGnduDropdown === "year" ? null : "year")
                      }
                      onChange={(value) => {
                        setGnduYearInput(value);
                        setOpenGnduDropdown(null);
                      }}
                    />
                  </View>

                  <View style={dropdownGridItem}>
                    <GnduDropdown
                      label="Month"
                      options={GNDU_MONTH_OPTIONS}
                      value={gnduMonthInput}
                      open={openGnduDropdown === "month"}
                      onToggle={() =>
                        setOpenGnduDropdown(openGnduDropdown === "month" ? null : "month")
                      }
                      onChange={(value) => {
                        setGnduMonthInput(value);
                        setOpenGnduDropdown(null);
                      }}
                    />
                  </View>
                </View>

                <View style={dropdownGrid}>
                  <View style={dropdownGridItem}>
                    <GnduDropdown
                      label="Course Type"
                      options={GNDU_COURSE_TYPE_OPTIONS}
                      value={gnduCourseTypeInput}
                      open={openGnduDropdown === "courseType"}
                      onToggle={() =>
                        setOpenGnduDropdown(
                          openGnduDropdown === "courseType" ? null : "courseType"
                        )
                      }
                      onChange={(value) => {
                        setGnduCourseTypeInput(value);
                        setOpenGnduDropdown(null);
                      }}
                    />
                  </View>

                  <View style={dropdownGridItem}>
                    <GnduDropdown
                      label="Semester"
                      options={gnduSemesterOptions}
                      value={gnduSemesterCodeInput}
                      open={openGnduDropdown === "semester"}
                      onToggle={() =>
                        setOpenGnduDropdown(
                          openGnduDropdown === "semester" ? null : "semester"
                        )
                      }
                      onChange={(value) => {
                        setGnduSemesterCodeInput(value);
                        setOpenGnduDropdown(null);
                      }}
                    />
                  </View>
                </View>

                <View style={[detectedCourseBox, { backgroundColor: theme.input, borderColor: theme.border }]}>
                  <Text style={[detectedCourseText, { color: theme.text }]}>
                    Course {inferredGnduCourseCode}
                  </Text>
                </View>

                <Text style={[mutedText, { color: theme.subtle, marginBottom: 12 }]}>
                  Searching {selectedGnduMonth} {gnduYearInput}, {selectedGnduCourseType}, {selectedGnduSemester}.
                </Text>

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
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={3} style={{ color: theme.text, fontSize: 18, lineHeight: 24, fontWeight: "900" }}>
                            {getCompactSemesterTitle(item.semester || `Semester ${index + 1}`)}
                          </Text>

                          <Text style={{ color: theme.muted, marginTop: 6 }}>
                            {item.resultStatus || "Pending"} - Credits:{" "}
                            {item.creditsEarned || "0"} - {subjects.length} subjects
                          </Text>
                        </View>

                        <View style={[semesterScoreBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                          <Text style={semesterScoreText}>{item.sgpa || "N/A"}</Text>
                        </View>
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
                                {subject.code} - Credits: {subject.credits}
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
  const compactValue = value.length > 6;

  return (
    <View style={[infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[infoTitle, { color: theme.muted }]}>{title}</Text>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{
          color,
          fontSize: compactValue ? 17 : 20,
          fontWeight: "900",
          marginTop: 10,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function GnduDropdown({
  label,
  options,
  value,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  options: GnduOption[];
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const theme = useAppTheme();
  const selected = options.find((option) => option.value === value);

  return (
    <View style={dropdownWrap}>
      <Text style={[fieldLabel, { color: theme.muted }]}>{label}</Text>

      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onToggle}
        style={[
          dropdownButton,
          { backgroundColor: theme.input, borderColor: open ? "#a78bfa" : theme.border },
        ]}
      >
        <Text style={[dropdownValue, { color: theme.text }]}>
          {selected?.label || value || "Select"}
        </Text>

        <View
          style={[
            dropdownChevron,
            {
              borderRightColor: open ? "#8b5cf6" : theme.muted,
              borderBottomColor: open ? "#8b5cf6" : theme.muted,
              transform: [{ rotate: open ? "225deg" : "45deg" }],
            },
          ]}
        />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={onToggle}>
        <Pressable
          onPress={onToggle}
          style={[dropdownBackdrop, { backgroundColor: theme.backdrop }]}
        >
          <Pressable
            style={[
              dropdownSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={modalHandle} />

            <Text style={[dropdownSheetTitle, { color: theme.text }]}>
              Select {label}
            </Text>

            <ScrollView style={dropdownScroll} showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const active = option.value === value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.86}
                    onPress={() => onChange(option.value)}
                    style={[
                      dropdownOption,
                      {
                        backgroundColor: active ? "#7c3aed" : theme.input,
                        borderColor: active ? "#a78bfa" : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        dropdownOptionText,
                        { color: active ? "white" : theme.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  minWidth: 0,
  backgroundColor: "#0f172a",
  padding: 14,
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

const semesterResultRow = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  justifyContent: "space-between" as const,
  gap: 14,
};

const semesterResultInfo = {
  flex: 1,
  minWidth: 0,
  paddingRight: 6,
};

const semesterResultTitle = {
  color: "white",
  fontSize: 20,
  lineHeight: 26,
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
  padding: 18,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const input = {
  backgroundColor: "#020617",
  color: "white",
  padding: 14,
  borderRadius: 18,
  marginBottom: 12,
  fontSize: 16,
  borderWidth: 1,
  borderColor: "#334155",
};

const fieldLabel = {
  fontSize: 12,
  fontWeight: "900" as const,
  marginBottom: 7,
};

const gnduHelpLine = {
  fontSize: 13,
  lineHeight: 18,
  marginTop: -2,
  marginBottom: 12,
};

const detectedCourseBox = {
  alignSelf: "flex-start" as const,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  marginBottom: 12,
};

const detectedCourseText = {
  fontSize: 13,
  fontWeight: "900" as const,
};

const dropdownGrid = {
  flexDirection: "row" as const,
  gap: 10,
  alignItems: "flex-start" as const,
  zIndex: 4,
};

const dropdownGridItem = {
  flex: 1,
  minWidth: 0,
};

const dropdownWrap = {
  marginBottom: 10,
};

const dropdownButton = {
  minHeight: 48,
  borderRadius: 16,
  borderWidth: 1,
  paddingHorizontal: 13,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

const dropdownValue = {
  flex: 1,
  fontSize: 15,
  fontWeight: "900" as const,
};

const dropdownChevron = {
  width: 9,
  height: 9,
  borderRightWidth: 2,
  borderBottomWidth: 2,
  marginLeft: 10,
};

const dropdownBackdrop = {
  flex: 1,
  justifyContent: "flex-end" as const,
  padding: 20,
};

const dropdownSheet = {
  borderWidth: 1,
  borderRadius: 26,
  padding: 18,
  maxHeight: "62%" as const,
};

const dropdownSheetTitle = {
  fontSize: 20,
  fontWeight: "900" as const,
  marginBottom: 14,
};

const dropdownScroll = {
  maxHeight: 360,
};

const dropdownOption = {
  minHeight: 48,
  borderRadius: 12,
  borderWidth: 1,
  paddingHorizontal: 14,
  justifyContent: "center" as const,
  marginBottom: 8,
};

const dropdownOptionText = {
  fontSize: 14,
  fontWeight: "900" as const,
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

const semesterScoreBox = {
  minWidth: 72,
  maxWidth: 92,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#1e293b",
};

const semesterScoreText = {
  color: "#22c55e",
  fontSize: 22,
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

import { showLocalNotification } from "./notifications";

type AttendanceSubject = {
  name?: string;
  attended?: number;
  total?: number;
};

type AttendanceChange = {
  name: string;
  totalDelta: number;
  presentDelta: number;
  absentDelta: number;
};

function getOverall(attendance: AttendanceSubject[]) {
  let totalAttended = 0;
  let totalLectures = 0;

  attendance.forEach((subject) => {
    totalAttended += subject.attended || 0;
    totalLectures += subject.total || 0;
  });

  return totalLectures > 0
    ? Math.round((totalAttended / totalLectures) * 100)
    : 0;
}

function resultHasRealData(result: any) {
  if (!result) return false;

  const subjects = result.subjects || [];

  return (
    result.available === true ||
    subjects.length > 0 ||
    (!!result.sgpa && result.sgpa !== "0" && result.sgpa !== "Not Available")
  );
}

function getAttendanceChanges(
  oldAttendance: AttendanceSubject[],
  newAttendance: AttendanceSubject[]
) {
  const oldByName = new Map(
    (oldAttendance || []).map((subject) => [subject.name, subject])
  );

  return (newAttendance || [])
    .map((subject) => {
      const previous = oldByName.get(subject.name);

      if (!previous || !subject.name) return null;

      const oldTotal = previous.total || 0;
      const newTotal = subject.total || 0;
      const oldAttended = previous.attended || 0;
      const newAttended = subject.attended || 0;

      if (newTotal <= oldTotal) return null;

      const totalDelta = newTotal - oldTotal;
      const presentDelta = Math.max(0, newAttended - oldAttended);
      const absentDelta = Math.max(0, totalDelta - presentDelta);

      return {
        name: subject.name,
        totalDelta,
        presentDelta,
        absentDelta,
      };
    })
    .filter(Boolean) as AttendanceChange[];
}

function getResultChanged(oldResult: any, newResult: any) {
  return (
    resultHasRealData(newResult) &&
    JSON.stringify(oldResult || null) !== JSON.stringify(newResult || null)
  );
}

async function notifyAttendanceChanges(
  changes: AttendanceChange[],
  newOverall: number
) {
  if (changes.length === 0) return;

  const presentUpdates = changes.filter((change) => change.presentDelta > 0);
  const absentUpdates = changes.filter((change) => change.absentDelta > 0);

  if (changes.length === 1) {
    const change = changes[0];
    const status =
      change.absentDelta > 0 && change.presentDelta === 0
        ? "absent"
        : change.presentDelta > 0 && change.absentDelta === 0
          ? "present"
          : "updated";

    await showLocalNotification(
      "Today's Attendance Updated",
      `${change.name} marked ${status}. Overall attendance: ${newOverall}%`
    );
    return;
  }

  const parts = [];
  if (presentUpdates.length > 0) {
    parts.push(`${presentUpdates.length} present`);
  }
  if (absentUpdates.length > 0) {
    parts.push(`${absentUpdates.length} absent`);
  }

  await showLocalNotification(
    "Today's Attendance Updated",
    `${parts.join(", ") || changes.length + " subject"} update${
      changes.length === 1 ? "" : "s"
    }. Overall attendance: ${newOverall}%`
  );
}

export async function notifyAcademicChanges({
  oldAttendance,
  newAttendance,
  oldResult,
  newResult,
}: {
  oldAttendance: AttendanceSubject[];
  newAttendance: AttendanceSubject[];
  oldResult: any;
  newResult: any;
}) {
  const oldOverall = getOverall(oldAttendance);
  const newOverall = getOverall(newAttendance);
  const attendanceChanges = getAttendanceChanges(oldAttendance, newAttendance);
  const resultChanged = getResultChanged(oldResult, newResult);

  if (resultChanged) {
    await showLocalNotification(
      "Result is Out",
      "Your latest GPA/result is now available in RollCall+."
    );
  }

  await notifyAttendanceChanges(attendanceChanges, newOverall);

  if (oldOverall >= 75 && newOverall < 75) {
    await showLocalNotification(
      "Attendance Dropped Below 75%",
      `Your overall attendance is now ${newOverall}%.`
    );
  }

  return {
    attendanceChanged: attendanceChanges.length > 0,
    resultChanged,
  };
}

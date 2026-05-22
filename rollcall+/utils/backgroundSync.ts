import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { showLocalNotification } from "./notifications";
import { LOGIN_URL } from "./api";

const BACKGROUND_TASK = "ROLLCALL_BACKGROUND_SYNC";

function getOverall(attendance: any[]) {
  let totalAttended = 0;
  let totalLectures = 0;

  attendance.forEach((subject: any) => {
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

function getAttendanceChanges(oldAttendance: any[], newAttendance: any[]) {
  const oldByName = new Map(
    (oldAttendance || []).map((subject: any) => [subject.name, subject])
  );

  return (newAttendance || [])
    .map((subject: any) => {
      const previous: any = oldByName.get(subject.name);

      if (!previous) return null;

      const oldTotal = previous.total || 0;
      const newTotal = subject.total || 0;
      const oldAttended = previous.attended || 0;
      const newAttended = subject.attended || 0;

      if (newTotal <= oldTotal) return null;

      const totalDelta = newTotal - oldTotal;
      const attendedDelta = newAttended - oldAttended;

      return {
        name: subject.name,
        totalDelta,
        attendedDelta,
        missedDelta: Math.max(0, totalDelta - attendedDelta),
      };
    })
    .filter(Boolean);
}

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const savedUser = await AsyncStorage.getItem("rollcall_user");

    if (!savedUser) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const user = JSON.parse(savedUser);

    if (!user.rollNumber || !user.password) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const response = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rollNumber: user.rollNumber,
        password: user.password,
        forceRefresh: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const oldAttendance = user.attendance || [];
    const newAttendance = data.attendance || [];
    const oldOverall = getOverall(oldAttendance);
    const newOverall = getOverall(newAttendance);
    const attendanceChanges = getAttendanceChanges(
      oldAttendance,
      newAttendance
    );

    const oldResult = user.result || null;
    const newResult = data.result || null;
    const oldResultString = JSON.stringify(oldResult);
    const newResultString = JSON.stringify(newResult);
    const resultChanged =
      resultHasRealData(newResult) && oldResultString !== newResultString;

    if (resultChanged) {
      await showLocalNotification(
        "New Result Published",
        "Your latest GPA/result is now available."
      );
    }

    const missedUpdates = attendanceChanges.filter(
      (change: any) => change.missedDelta > 0
    );

    if (missedUpdates.length > 0) {
      await showLocalNotification(
        "Attendance Updated",
        `${missedUpdates.length} subject${
          missedUpdates.length === 1 ? "" : "s"
        } recorded a missed lecture. Overall: ${newOverall}%`
      );
    } else if (attendanceChanges.length > 0) {
      await showLocalNotification(
        "Attendance Synced",
        `New lecture data is available. Overall attendance: ${newOverall}%`
      );
    }

    if (oldOverall >= 75 && newOverall < 75) {
      await showLocalNotification(
        "Attendance Dropped Below 75%",
        `Your overall attendance is now ${newOverall}%.`
      );
    }

    await AsyncStorage.setItem(
      "rollcall_user",
      JSON.stringify({
        ...user,
        attendance: newAttendance,
        result: newResult,
        results: data.results || user.results || [],
        savedAt: new Date().toISOString(),
      })
    );

    return attendanceChanges.length > 0 || resultChanged
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.log("Background sync error:", error);

    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log("Background fetch is not available:", status);
      return;
    }

    const registeredTasks = await TaskManager.getRegisteredTasksAsync();
    const alreadyRegistered = registeredTasks.some(
      (task) => task.taskName === BACKGROUND_TASK
    );

    if (alreadyRegistered) {
      return;
    }

    return await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
    console.log("Register background task error:", error);
  }
}

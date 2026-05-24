import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { notifyAcademicChanges } from "./academicNotifications";
import { LOGIN_URL } from "./api";

const BACKGROUND_TASK = "ROLLCALL_BACKGROUND_SYNC";

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
    const oldResult = user.result || null;
    const newResult = data.result || null;
    const academicChanges = await notifyAcademicChanges({
      oldAttendance,
      newAttendance,
      oldResult,
      newResult,
    });

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

    return academicChanges.attendanceChanged || academicChanges.resultChanged
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

import { create } from "zustand";
import type { ThemeMode } from "../theme/colors";

type Subject = {
  name: string;
  attended: number;
  missed: number;
  total: number;
  history?: any[];
};

type Student = {
  name?: string;
  rollNumber?: string;
  photo?: string;
  profilePic?: string;
  image?: string;
  course?: string;
  semester?: string;
  section?: string;
  labGroup?: string;
  batch?: string;
  universityRollNo?: string;
  fatherName?: string;
  motherName?: string;
  email?: string;
  mobile?: string;
};

type ResultSubject = {
  name: string;
  code: string;
  credits: string;
  grade: string;
};

export type Result = {
  available?: boolean;
  semester?: string;
  sgpa?: string;
  resultStatus?: string;
  creditsEarned?: string;
  subjects?: ResultSubject[];
};

type AppStore = {
  student: Student | null;
  attendance: Subject[];
  result: Result | null;
  results: Result[];
  password: string;
  themeMode: ThemeMode;

  setUserData: (data: {
    student: Student;
    attendance: Subject[];
    result: Result | null;
    results?: Result[];
    password: string;
  }) => void;

  updateAttendance: (attendance: Subject[]) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  clearUser: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  student: null,
  attendance: [],
  result: null,
  results: [],
  password: "",
  themeMode: "dark",

  setUserData: ({ student, attendance, result, results = [], password }) =>
    set({
      student,
      attendance,
      result,
      results,
      password,
    }),

  updateAttendance: (attendance) =>
    set({
      attendance,
    }),

  setThemeMode: (themeMode) =>
    set({
      themeMode,
    }),

  clearUser: () =>
    set({
      student: null,
      attendance: [],
      result: null,
      results: [],
      password: "",
    }),
}));

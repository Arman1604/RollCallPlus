import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = Constants.expoConfig?.extra as ExtraConfig | undefined;

export const API_BASE_URL =
  extra?.apiBaseUrl || "http://192.168.29.55:5000";

export const LOGIN_URL = `${API_BASE_URL.replace(/\/+$/, "")}/login`;

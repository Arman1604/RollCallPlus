import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = Constants.expoConfig?.extra as ExtraConfig | undefined;

export const API_BASE_URL =
  extra?.apiBaseUrl || "http://192.168.29.55:5000";

const normalizedApiBaseUrl = API_BASE_URL.replace(/\/+$/, "");

export const LOGIN_URL = `${normalizedApiBaseUrl}/login`;
export const HEALTH_URL = `${normalizedApiBaseUrl}/health`;
export const GNDU_RESULT_URL = `${normalizedApiBaseUrl}/gndu-result`;
export const PUSH_TOKEN_URL = `${normalizedApiBaseUrl}/push-token`;
export const SUPPORT_TICKET_URL = `${normalizedApiBaseUrl}/support-ticket`;
export const SUPPORT_TICKET_STATUS_URL = `${normalizedApiBaseUrl}/support-ticket-status`;

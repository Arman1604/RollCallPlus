import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAppTheme } from "../theme/useAppTheme";
import { API_BASE_URL, HEALTH_URL } from "../utils/api";

type HealthResponse = {
  status?: string;
  service?: string;
  version?: string;
  nativeScraperEnabled?: boolean;
  railwayFallbackEnabled?: boolean;
  upstreamConfigured?: boolean;
};

type StatusState = {
  data: HealthResponse | null;
  error: string;
  latencyMs: number | null;
  checkedAt: string;
};

function formatCheckedAt(value: string) {
  if (!value) return "Not checked yet";

  return new Date(value).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function BackendStatus() {
  const theme = useAppTheme();
  const [status, setStatus] = useState<StatusState>({
    data: null,
    error: "",
    latencyMs: null,
    checkedAt: "",
  });
  const [loading, setLoading] = useState(true);

  const checkBackend = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);

    try {
      const response = await fetch(HEALTH_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data?.message || `Health check failed (${response.status})`);
      }

      setStatus({
        data,
        error: "",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      setStatus({
        data: null,
        error: String(error instanceof Error ? error.message : error),
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  const isHealthy = status.data?.status === "success" && !status.error;
  const runtimeLabel = status.data?.nativeScraperEnabled
    ? "Cloudflare native"
    : "Railway proxy";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={checkBackend}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={screen}>
          <View style={headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={[backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={[eyebrow, { color: theme.primary }]}>SYSTEM CHECK</Text>
              <Text style={[title, { color: theme.text }]}>Backend Status</Text>
            </View>
          </View>

          <View style={[heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[statusIcon, { backgroundColor: isHealthy ? "#22c55e22" : "#ef444422" }]}>
              {loading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Ionicons
                  name={isHealthy ? "checkmark-circle" : "warning"}
                  size={34}
                  color={isHealthy ? theme.success : theme.danger}
                />
              )}
            </View>

            <Text style={[heroTitle, { color: theme.text }]}>
              {loading ? "Checking API" : isHealthy ? "Cloudflare is online" : "Backend needs attention"}
            </Text>
            <Text style={[heroSubtitle, { color: theme.muted }]}>
              {status.error || status.data?.service || "Pull down or tap refresh to check again."}
            </Text>
          </View>

          <View style={grid}>
            <StatusCard
              label="Runtime"
              value={status.data ? runtimeLabel : "Unknown"}
              icon="cloud-outline"
              tone={status.data?.nativeScraperEnabled ? theme.success : theme.warning}
            />
            <StatusCard
              label="Fallback"
              value={status.data?.railwayFallbackEnabled ? "Enabled" : "Off"}
              icon="git-branch-outline"
              tone={status.data?.railwayFallbackEnabled ? theme.warning : theme.success}
            />
            <StatusCard
              label="Latency"
              value={status.latencyMs === null ? "--" : `${status.latencyMs} ms`}
              icon="speedometer-outline"
              tone={theme.info}
            />
            <StatusCard
              label="Version"
              value={status.data?.version || "Unknown"}
              icon="cube-outline"
              tone={theme.primary}
            />
          </View>

          <View style={[detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <DetailRow label="API Base" value={API_BASE_URL} />
            <DetailRow label="Health URL" value={HEALTH_URL} />
            <DetailRow
              label="Native scraper"
              value={status.data?.nativeScraperEnabled ? "True" : "False"}
            />
            <DetailRow
              label="Railway upstream"
              value={status.data?.upstreamConfigured ? "Configured" : "Not configured"}
            />
            <DetailRow label="Last checked" value={formatCheckedAt(status.checkedAt)} />
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={checkBackend}
            disabled={loading}
            style={[refreshButton, { opacity: loading ? 0.7 : 1 }]}
          >
            <Ionicons name="refresh" size={22} color="#ffffff" />
            <Text style={refreshText}>{loading ? "Checking..." : "Refresh status"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

function StatusCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={[statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[smallIcon, { backgroundColor: `${tone}22` }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <Text style={[cardLabel, { color: theme.subtle }]}>{label}</Text>
      <Text style={[cardValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[detailRow, { borderBottomColor: theme.border }]}>
      <Text style={[detailLabel, { color: theme.subtle }]}>{label}</Text>
      <Text style={[detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const screen = {
  padding: 20,
  paddingTop: 64,
  paddingBottom: 44,
};

const headerRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 14,
};

const backButton = {
  width: 48,
  height: 48,
  borderRadius: 18,
  borderWidth: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const eyebrow = {
  fontSize: 13,
  fontWeight: "900" as const,
};

const title = {
  fontSize: 34,
  fontWeight: "900" as const,
  marginTop: 4,
};

const heroCard = {
  marginTop: 28,
  borderRadius: 28,
  padding: 24,
  borderWidth: 1,
  alignItems: "center" as const,
};

const statusIcon = {
  width: 72,
  height: 72,
  borderRadius: 24,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const heroTitle = {
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 18,
  textAlign: "center" as const,
};

const heroSubtitle = {
  fontSize: 15,
  fontWeight: "700" as const,
  lineHeight: 22,
  marginTop: 8,
  textAlign: "center" as const,
};

const grid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 12,
  marginTop: 18,
};

const statusCard = {
  width: "48%" as const,
  minHeight: 136,
  borderRadius: 24,
  borderWidth: 1,
  padding: 16,
};

const smallIcon = {
  width: 38,
  height: 38,
  borderRadius: 14,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const cardLabel = {
  fontSize: 13,
  fontWeight: "800" as const,
  marginTop: 14,
};

const cardValue = {
  fontSize: 18,
  fontWeight: "900" as const,
  marginTop: 6,
};

const detailCard = {
  marginTop: 18,
  borderRadius: 24,
  borderWidth: 1,
  paddingHorizontal: 18,
};

const detailRow = {
  paddingVertical: 16,
  borderBottomWidth: 1,
};

const detailLabel = {
  fontSize: 13,
  fontWeight: "800" as const,
  marginBottom: 6,
};

const detailValue = {
  fontSize: 15,
  fontWeight: "800" as const,
  lineHeight: 21,
};

const refreshButton = {
  marginTop: 22,
  height: 58,
  borderRadius: 22,
  backgroundColor: "#7c3aed",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 10,
};

const refreshText = {
  color: "#ffffff",
  fontSize: 17,
  fontWeight: "900" as const,
};

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BottomTabs from "../components/BottomTabs";
import { useAppStore } from "../store/useAppStore";
import { useAppTheme } from "../theme/useAppTheme";
import { SUPPORT_TICKET_STATUS_URL } from "../utils/api";

type SupportTicket = {
  id: string;
  status: "open" | "replied" | "closed" | "failed" | "local";
  category: string;
  priority: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
  reply?: {
    message: string;
    repliedAt: string;
  } | null;
};

function getSupportTicketsKey(rollNumber?: string) {
  const cleanRoll = String(rollNumber || "").trim();
  return cleanRoll ? `supportTickets:${cleanRoll}` : "supportTickets";
}

function getTicketStatusLabel(status: SupportTicket["status"]) {
  if (status === "replied") return "Replied";
  if (status === "closed") return "Closed";
  if (status === "failed") return "Failed";
  if (status === "local") return "Local only";
  return "Open";
}

function getTicketStatusColor(status: SupportTicket["status"]) {
  if (status === "replied") return "#38bdf8";
  if (status === "closed") return "#64748b";
  if (status === "failed") return "#ef4444";
  if (status === "local") return "#f59e0b";
  return "#22c55e";
}

function getTicketStatusIcon(status: SupportTicket["status"]) {
  if (status === "closed") return "checkmark-circle";
  if (status === "replied") return "chatbubble-ellipses";
  if (status === "failed" || status === "local") return "alert-circle";
  return "time";
}

function formatDate(value?: string) {
  if (!value) return "Not updated";

  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SupportTickets() {
  const theme = useAppTheme();
  const student = useAppStore((state) => state.student);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const ticketsKey = getSupportTicketsKey(student?.rollNumber);

  const saveTickets = useCallback(
    async (nextTickets: SupportTicket[]) => {
      setTickets(nextTickets);
      await AsyncStorage.setItem(ticketsKey, JSON.stringify(nextTickets));
    },
    [ticketsKey]
  );

  const refreshTickets = useCallback(
    async (ticketsToRefresh: SupportTicket[], showError = true) => {
      if (ticketsToRefresh.length === 0) return;

      try {
        setRefreshing(true);
        const response = await fetch(SUPPORT_TICKET_STATUS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rollNumber: student?.rollNumber || "",
            ticketIds: ticketsToRefresh.map((ticket) => ticket.id),
          }),
        });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data.tickets)) {
          throw new Error(data?.message || "Ticket refresh failed");
        }

        const remoteTickets = data.tickets as SupportTicket[];
        const remoteById = new Map(
          remoteTickets.map((ticket) => [ticket.id, ticket])
        );
        const updated = ticketsToRefresh.map((ticket) => ({
          ...ticket,
          ...(remoteById.get(ticket.id) || {
            status: "local" as const,
            updatedAt: new Date().toISOString(),
          }),
        }));
        const localIds = new Set(ticketsToRefresh.map((ticket) => ticket.id));
        const recoveredTickets = remoteTickets.filter(
          (ticket) => !localIds.has(ticket.id)
        );

        await saveTickets([...recoveredTickets, ...updated].slice(0, 10));
      } catch (error) {
        if (showError) {
          Alert.alert(
            "Support Tickets",
            String(error instanceof Error ? error.message : "Could not refresh tickets.")
          );
        }
      } finally {
        setRefreshing(false);
      }
    },
    [saveTickets, student?.rollNumber]
  );

  const loadTickets = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(ticketsKey);
      const parsedTickets: SupportTicket[] = saved ? JSON.parse(saved) : [];
      setTickets(parsedTickets);
      if (parsedTickets.length > 0) {
        refreshTickets(parsedTickets, false);
      }
    } catch (error) {
      console.log("Support ticket history load error:", error);
    }
  }, [refreshTickets, ticketsKey]);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets])
  );

  function deleteTicket(ticketId: string) {
    Alert.alert(
      "Delete Ticket",
      "This removes the ticket from this phone only. The admin record stays safe.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await saveTickets(tickets.filter((ticket) => ticket.id !== ticketId));
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[screen, { backgroundColor: theme.dashboardBackground }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refreshTickets(tickets)}
              tintColor={theme.primary}
            />
          }
        >
          <View style={header}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => router.back()}
              style={[backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="chevron-back" size={23} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => refreshTickets(tickets)}
              disabled={refreshing || tickets.length === 0}
              style={[
                refreshButton,
                {
                  backgroundColor: theme.primarySoft,
                  opacity: refreshing || tickets.length === 0 ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name={refreshing ? "sync" : "refresh"} size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <Text style={[eyebrow, { color: theme.primary }]}>SUPPORT CENTER</Text>
          <Text style={[title, { color: theme.text }]}>My Tickets</Text>
          <Text style={[subtitle, { color: theme.muted }]}>
            Track support replies and keep your ticket history tidy.
          </Text>

          {tickets.length === 0 ? (
            <View style={[emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="file-tray-outline" size={34} color={theme.subtle} />
              <Text style={[emptyTitle, { color: theme.text }]}>No tickets yet</Text>
              <Text style={[emptyText, { color: theme.muted }]}>
                Create a support ticket from Profile and it will appear here.
              </Text>
            </View>
          ) : (
            tickets.map((ticket) => {
              const statusColor = getTicketStatusColor(ticket.status);

              return (
                <View
                  key={ticket.id}
                  style={[ticketCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={ticketTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[ticketId, { color: theme.text }]}>{ticket.id}</Text>
                      <Text style={[ticketMeta, { color: theme.subtle }]}>
                        {ticket.category} - {ticket.priority}
                      </Text>
                    </View>

                    <View
                      style={[
                        statusPill,
                        {
                          backgroundColor: `${statusColor}22`,
                          borderColor: statusColor,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getTicketStatusIcon(ticket.status)}
                        size={13}
                        color={statusColor}
                      />
                      <Text style={[statusText, { color: statusColor }]}>
                        {getTicketStatusLabel(ticket.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[messageLabel, { color: theme.subtle }]}>Your message</Text>
                  <Text style={[messageText, { color: theme.text }]}>{ticket.message}</Text>

                  <View style={[replyBox, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <View style={replyHeader}>
                      <Ionicons
                        name={ticket.reply?.message ? "chatbubble-ellipses" : "time-outline"}
                        size={18}
                        color={ticket.reply?.message ? theme.primary : theme.subtle}
                      />
                      <Text
                        style={[
                          replyTitle,
                          { color: ticket.reply?.message ? theme.primary : theme.subtle },
                        ]}
                      >
                        {ticket.reply?.message
                          ? ticket.status === "closed"
                            ? "Support Reply - Closed"
                            : "Support Reply"
                          : "Waiting for reply"}
                      </Text>
                    </View>

                    <Text style={[replyText, { color: ticket.reply?.message ? theme.text : theme.muted }]}>
                      {ticket.reply?.message || "We will show the admin reply here after support responds."}
                    </Text>
                  </View>

                  <View style={ticketFooter}>
                    <View style={{ flex: 1 }}>
                      <Text style={[updatedLabel, { color: theme.subtle }]}>
                        Last updated
                      </Text>
                      <Text style={[updatedText, { color: theme.text }]}>
                        {formatDate(ticket.updatedAt || ticket.createdAt)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => deleteTicket(ticket.id)}
                      style={[deleteButton, { backgroundColor: `${theme.danger}18` }]}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.danger} />
                      <Text style={[deleteText, { color: theme.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <BottomTabs active="profile" />
      </View>
    </>
  );
}

const screen = {
  flex: 1,
};

const content = {
  paddingTop: 58,
  paddingHorizontal: 20,
  paddingBottom: 130,
};

const header = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 26,
};

const backButton = {
  width: 46,
  height: 46,
  borderRadius: 16,
  borderWidth: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const refreshButton = {
  width: 46,
  height: 46,
  borderRadius: 16,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const eyebrow = {
  fontSize: 14,
  fontWeight: "900" as const,
  letterSpacing: 0,
  marginBottom: 8,
};

const title = {
  fontSize: 46,
  fontWeight: "900" as const,
  letterSpacing: 0,
};

const subtitle = {
  fontSize: 18,
  lineHeight: 26,
  marginTop: 10,
  marginBottom: 28,
};

const emptyCard = {
  borderWidth: 1,
  borderRadius: 26,
  padding: 28,
  alignItems: "center" as const,
};

const emptyTitle = {
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 14,
};

const emptyText = {
  fontSize: 16,
  lineHeight: 23,
  textAlign: "center" as const,
  marginTop: 8,
};

const ticketCard = {
  borderWidth: 1,
  borderRadius: 26,
  padding: 18,
  marginBottom: 16,
};

const ticketTop = {
  flexDirection: "row" as const,
  gap: 12,
  alignItems: "flex-start" as const,
  marginBottom: 16,
};

const ticketId = {
  fontSize: 18,
  fontWeight: "900" as const,
  lineHeight: 24,
};

const ticketMeta = {
  fontSize: 13,
  fontWeight: "800" as const,
  marginTop: 4,
};

const statusPill = {
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 7,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 5,
};

const statusText = {
  fontSize: 12,
  fontWeight: "900" as const,
};

const messageLabel = {
  fontSize: 12,
  fontWeight: "900" as const,
  marginBottom: 6,
};

const messageText = {
  fontSize: 16,
  lineHeight: 23,
  fontWeight: "700" as const,
  marginBottom: 14,
};

const replyBox = {
  borderWidth: 1,
  borderRadius: 20,
  padding: 14,
};

const replyHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  marginBottom: 8,
};

const replyTitle = {
  fontSize: 13,
  fontWeight: "900" as const,
};

const replyText = {
  fontSize: 15,
  lineHeight: 22,
  fontWeight: "700" as const,
};

const ticketFooter = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  gap: 12,
  marginTop: 14,
};

const updatedLabel = {
  fontSize: 12,
  fontWeight: "800" as const,
};

const updatedText = {
  fontSize: 13,
  fontWeight: "900" as const,
  marginTop: 2,
};

const deleteButton = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 9,
};

const deleteText = {
  fontSize: 12,
  fontWeight: "900" as const,
};

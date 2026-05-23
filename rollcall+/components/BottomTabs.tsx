import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { useAppTheme } from "../theme/useAppTheme";

type TabKey = "home" | "today" | "analytics" | "gpa" | "profile" | "predictor";
type TabIcon = ComponentProps<typeof Ionicons>["name"];

type Props = {
  active: TabKey;
};

export default function BottomTabs({ active }: Props) {
  const theme = useAppTheme();

  function go(
    path: "/dashboard" | "/today" | "/analytics" | "/gpa" | "/profile" | "/predictor"
  ) {
    router.push(path);
  }

  return (
    <View
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 18,
        backgroundColor: theme.tabBar,
        borderRadius: 34,
        paddingHorizontal: 10,
        paddingVertical: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: theme.shadow,
        shadowOpacity: theme.mode === "dark" ? 0.28 : 0.14,
        shadowRadius: 24,
        elevation: 18,
      }}
    >
      <Tab label="Home" icon="home" active={active === "home"} onPress={() => go("/dashboard")} />
      <Tab label="Today" icon="calendar" active={active === "today"} onPress={() => go("/today")} />
      <Tab label="GPA" icon="school" active={active === "gpa"} onPress={() => go("/gpa")} />
      <Tab label="AI" icon="sparkles" active={active === "predictor"} onPress={() => go("/predictor")} />
      <Tab label="Me" icon="person" active={active === "profile"} onPress={() => go("/profile")} />
    </View>
  );
}

function Tab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: TabIcon;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {active && (
        <View
          style={{
            position: "absolute",
            top: -6,
            width: 54,
            height: 54,
            borderRadius: 999,
            backgroundColor: "rgba(124,58,237,0.18)",
            borderWidth: 1,
            borderColor: "rgba(139,92,246,0.4)",
          }}
        />
      )}

      <View
        style={{
          width: active ? 48 : 42,
          height: active ? 48 : 42,
          borderRadius: 999,
          backgroundColor: active ? theme.primary : "transparent",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={active ? 25 : 22}
          color={active ? "#ffffff" : theme.subtle}
        />
      </View>

      <Text
        style={{
          color: active ? theme.text : theme.subtle,
          fontSize: active ? 12 : 11,
          fontWeight: "900",
          marginTop: 6,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

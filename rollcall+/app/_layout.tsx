import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from '@/store/useAppStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  useEffect(() => {
    AsyncStorage.getItem("rollcall_theme").then((savedTheme) => {
      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeMode(savedTheme);
      }
    });
  }, [setThemeMode]);

  return (
    <ThemeProvider value={themeMode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

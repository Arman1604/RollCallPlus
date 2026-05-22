import { themes } from "./colors";
import { useAppStore } from "../store/useAppStore";

export function useAppTheme() {
  const themeMode = useAppStore((state) => state.themeMode);
  return themes[themeMode];
}

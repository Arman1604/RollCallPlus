import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useAppTheme } from "../theme/useAppTheme";

export default function DashboardSkeleton() {
  const theme = useAppTheme();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={{ paddingTop: 70, paddingHorizontal: 20 }}>
      <Animated.View style={[box(180, 26, theme.surface), animatedStyle]} />
      <Animated.View style={[box(120, 16, theme.surface), animatedStyle]} />

      <Animated.View
        style={[
          {
            height: 230,
            borderRadius: 32,
            backgroundColor: theme.surface,
            marginTop: 28,
          },
          animatedStyle,
        ]}
      />

      <Animated.View
        style={[
          {
            height: 70,
            borderRadius: 24,
            backgroundColor: theme.surface,
            marginTop: 18,
          },
          animatedStyle,
        ]}
      />

      {[1, 2, 3, 4].map((item) => (
        <Animated.View
          key={item}
          style={[
            {
              height: 86,
              borderRadius: 24,
              backgroundColor: theme.surface,
              marginTop: 16,
            },
            animatedStyle,
          ]}
        />
      ))}
    </View>
  );
}

function box(width: number, height: number, backgroundColor: string) {
  return {
    width,
    height,
    borderRadius: 999,
    backgroundColor,
    marginBottom: 12,
  };
}

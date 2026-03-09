import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { colors } from '@/styles/tokens';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.border },
        animatedStyle,
        style,
      ]}
    />
  );
}

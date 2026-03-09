import { Pressable, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  scaleTo?: number;
}

export function PressableScale({ scaleTo = 0.96, style, children, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style as any]}
      onPressIn={() => { scale.value = withSpring(scaleTo, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;

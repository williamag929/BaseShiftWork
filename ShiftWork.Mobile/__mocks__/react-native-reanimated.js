// Manual mock for react-native-reanimated — avoids the worklets plugin requirement
const Reanimated = {
  default: {},
  useSharedValue: jest.fn((v) => ({ value: v })),
  useAnimatedStyle: jest.fn(() => ({})),
  withSpring: jest.fn((v) => v),
  withTiming: jest.fn((v) => v),
  withDelay: jest.fn((_, v) => v),
  withSequence: jest.fn((...args) => args[args.length - 1]),
  interpolateColor: jest.fn(() => '#ffffff'),
  interpolate: jest.fn(() => 0),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  FadeIn: { duration: jest.fn().mockReturnThis() },
  FadeInDown: { duration: jest.fn().mockReturnThis(), delay: jest.fn().mockReturnThis() },
  FadeOut: { duration: jest.fn().mockReturnThis() },
  SlideInRight: { duration: jest.fn().mockReturnThis() },
  SlideOutLeft: { duration: jest.fn().mockReturnThis() },
  Easing: { inOut: jest.fn((e) => e), bezier: jest.fn(() => (t) => t), out: jest.fn((e) => e) },
  runOnJS: jest.fn((fn) => fn),
  runOnUI: jest.fn((fn) => fn),
  makeMutable: jest.fn((v) => ({ value: v })),
  createAnimatedComponent: jest.fn((c) => c),
};

// Animated namespace with passthrough components
const { View, Text, ScrollView, FlatList, Image } = require('react-native');
Reanimated.Animated = {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  createAnimatedComponent: jest.fn((c) => c),
};

module.exports = Reanimated;

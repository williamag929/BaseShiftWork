import { Redirect } from 'expo-router';
import { useDeviceStore } from '@/store/deviceStore';

// Boot gate: redirect to setup if not enrolled, otherwise go directly to kiosk.
export default function Index() {
  const isEnrolled = useDeviceStore((s) => s.isEnrolled);
  return <Redirect href={isEnrolled ? '/(kiosk)' : '/(setup)'} />;
}

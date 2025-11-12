import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notification.service';
import { useAuthStore } from '../store/authStore';
import { router } from 'expo-router';

export interface UseNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
  isRegistered: boolean;
}

/**
 * Hook for managing push notifications in the app
 * Handles registration, token storage, and notification responses
 */
export function useNotifications(): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  const { companyId, personId } = useAuthStore();

  useEffect(() => {
    if (!companyId || !personId) {
      return;
    }

    // Register for push notifications
    const registerPushNotifications = async () => {
      try {
        const token = await notificationService.registerForPushNotifications();
        
        if (token) {
          setExpoPushToken(token);
          
          // Save token to backend
          await notificationService.saveDeviceToken(parseInt(companyId), personId, token);
          setIsRegistered(true);
          
          console.log('Push notification token registered:', token);
        } else {
          setError('Failed to get push token');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Error registering push notifications:', err);
      }
    };

    registerPushNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        setNotification(notification);
      }
    );

    // Listen for user interactions with notifications
    responseListener.current = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        handleNotificationResponse(response);
      }
    );

    // Check if app was opened by a notification (cold start)
    notificationService.getLastNotificationResponse().then((response) => {
      if (response) {
        console.log('App opened from notification:', response);
        handleNotificationResponse(response);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [companyId, personId]);

  // Handle navigation based on notification type
  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    
    // Clear badge count when user interacts with notification
    notificationService.clearBadgeCount();

    // Navigate based on notification type
    if (data?.type) {
      switch (data.type) {
        case 'schedule_published':
          // Navigate to weekly schedule or dashboard
          router.push('/(tabs)/weekly-schedule' as any);
          break;
        
        case 'time_off_approved':
        case 'time_off_denied':
          // Navigate to dashboard to see time off status
          router.push('/(tabs)/dashboard' as any);
          break;
        
        case 'shift_assigned':
        case 'shift_changed':
          // Navigate to schedule
          router.push('/(tabs)/schedule' as any);
          break;
        
        default:
          // Default to dashboard
          router.push('/(tabs)/dashboard' as any);
          break;
      }
    }
  };

  return {
    expoPushToken,
    notification,
    error,
    isRegistered,
  };
}

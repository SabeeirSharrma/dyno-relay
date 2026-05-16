import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  priority?: string;
  tag?: string;
  source?: string;
  timestamp: number;
}

export const STORAGE_KEYS = {
  NOTIFICATIONS: '@dyno_notifications',
  SERVER_URL: '@dyno_server_url',
  API_KEY: '@dyno_api_key',
};

export const loadNotifications = async (): Promise<NotificationPayload[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load notifications', e);
    return [];
  }
};

export const saveNotifications = async (notifications: NotificationPayload[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
};

export const loadSettings = async () => {
  try {
    const url = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
    const key = await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
    return { url: url || '', key: key || '' };
  } catch (e) {
    console.error('Failed to load settings', e);
    return { url: '', key: '' };
  }
};

export const saveSettings = async (url: string, key: string) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url);
    await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, key);
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

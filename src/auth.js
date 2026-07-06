import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY         = 'tg_token';
const USER_KEY          = 'tg_user';
const ONBOARDING_KEY    = 'tg_onboarding_done';
const DESKTOP_INTRO_KEY = 'tg_desktop_intro_done';

export const saveAuth = async (token, username) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, username);
};

export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const getUser  = () => AsyncStorage.getItem(USER_KEY);

export const markOnboardingDone   = () => AsyncStorage.setItem(ONBOARDING_KEY, '1');
export const markOnboardingNeeded = () => AsyncStorage.setItem(ONBOARDING_KEY, '0');
export const isOnboardingDone     = async () => {
  const v = await AsyncStorage.getItem(ONBOARDING_KEY);
  // null means key was never set (e.g. returning user on a fresh browser) — treat as done
  return v !== '0';
};

export const isDesktopIntroDone  = async () => (await AsyncStorage.getItem(DESKTOP_INTRO_KEY)) === '1';
export const markDesktopIntroDone = () => AsyncStorage.setItem(DESKTOP_INTRO_KEY, '1');

export const clearAuth = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
  await AsyncStorage.removeItem(ONBOARDING_KEY);
};

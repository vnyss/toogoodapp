import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'tg_token';
const USER_KEY  = 'tg_user';

export const saveAuth = async (token, username) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, username);
};

export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const getUser  = () => AsyncStorage.getItem(USER_KEY);

export const clearAuth = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
};

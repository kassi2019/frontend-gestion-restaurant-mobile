import Toast from 'react-native-toast-message';

export const showToast = {
  success: (text: string) => Toast.show({ type: 'success', text1: 'Succes', text2: text, visibilityTime: 10000, topOffset: 50 }),
  error: (text: string) => Toast.show({ type: 'error', text1: 'Erreur', text2: text, visibilityTime: 10000, topOffset: 50 }),
  warning: (text: string) => Toast.show({ type: 'info', text1: 'Attention', text2: text, visibilityTime: 12000, topOffset: 50 }),
};

import Toast from 'react-native-toast-message';

export const showToast = {
  success: (text: string) => Toast.show({ type: 'success', text1: 'Succès', text2: text, visibilityTime: 8000 }),
  error: (text: string) => Toast.show({ type: 'error', text1: 'Erreur', text2: text, visibilityTime: 8000 }),
  warning: (text: string) => Toast.show({ type: 'info', text1: 'Attention', text2: text, visibilityTime: 8000 }),
};

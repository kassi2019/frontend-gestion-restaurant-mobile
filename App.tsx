import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/services/toastConfig';
import { setupAudio } from './src/services/sound';

export default function App() {
  useEffect(() => {
    setupAudio();
  }, []);

  return (
    <Provider store={store}>
      <StatusBar style="dark" />
      <AppNavigator />
      <Toast config={toastConfig} />
    </Provider>
  );
}

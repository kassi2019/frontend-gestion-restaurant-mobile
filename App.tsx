import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';

export default function App() {
  return (
    <Provider store={store}>
      <StatusBar style="dark" />
      <AppNavigator />
      <Toast />
    </Provider>
  );
}

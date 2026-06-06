import React, { useEffect, Component } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { View, Text, StyleSheet } from 'react-native';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/services/toastConfig';
import { setupAudio } from './src/services/sound';

// Error boundary pour éviter les crashs au démarrage
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Erreur</Text>
          <Text style={styles.errorText}>{this.state.error?.message || 'Une erreur est survenue'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    // Délai pour éviter un crash au démarrage sur les builds standalone (expo-av)
    const timer = setTimeout(() => {
      setupAudio();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <StatusBar style="dark" />
        <AppNavigator />
        <Toast config={toastConfig} />
      </Provider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 24,
  },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#E53E3E', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#555', textAlign: 'center' },
});

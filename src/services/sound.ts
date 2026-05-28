import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let sound: Audio.Sound | null = null;

// Vibreur court (200ms) — intégré, pas de dépendance supplémentaire
export function vibrate() {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(200);
    } else {
      // iOS: pattern [attente, vibration, attente, vibration]
      Vibration.vibrate([0, 200]);
    }
  } catch (e) {
    // Silencieux si le vibreur échoue
  }
}

export async function playNotificationSound() {
  vibrate();
  try {
    if (!sound) {
      const { sound: s } = await Audio.Sound.createAsync(
        require('./notification2.wav'),
        { shouldPlay: false, volume: 0.9 }
      );
      sound = s;
    }

    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch (e) {
    // Silencieux si le son échoue
  }
}

export async function setupAudio() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (e) {
    // Ignorer
  }
}

import { Audio } from 'expo-av';

let sound: Audio.Sound | null = null;

export async function playNotificationSound() {
  try {
    // Charger le son une seule fois
    if (!sound) {
      const { sound: s } = await Audio.Sound.createAsync(
        // Son de notification intégré (bip court)
        require('./notification.wav'),
        { shouldPlay: false, volume: 0.5 }
      );
      sound = s;
    }

    // Rejouer depuis le début
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch (e) {
    // Silencieux si le son échoue
  }
}

// Configurer l'audio pour les notifications
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

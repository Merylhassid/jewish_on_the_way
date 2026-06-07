import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied';

export interface GeoCoords { lat: number; lng: number }

export function useLocation(autoRequest = true) {
  const [status, setStatus]     = useState<LocationStatus>('idle');
  const [coords, setCoords]     = useState<GeoCoords | null>(null);

  const request = useCallback(async () => {
    setStatus('requesting');
    const { status: s } = await Location.requestForegroundPermissionsAsync();
    if (s !== 'granted') { setStatus('denied'); return null; }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      setStatus('granted');
      return c;
    } catch {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
      if (last) {
        const c = { lat: last.coords.latitude, lng: last.coords.longitude };
        setCoords(c);
        setStatus('granted');
        return c;
      }
      setStatus('denied');
      return null;
    }
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  useEffect(() => { if (autoRequest) request(); }, []);

  return { status, coords, request, openSettings };
}

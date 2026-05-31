import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '@/src/api/client';

interface Props {
  entityType: 'restaurant' | 'synagogue';
  entityId: number;
  size?: number;
  color?: string;
}

const STORAGE_KEY = 'user_favorites_local';

async function getLocalFavorites(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function setLocalFavorite(key: string, value: boolean) {
  const favs = await getLocalFavorites();
  if (value) favs[key] = true;
  else delete favs[key];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export default function FavoriteButton({ entityType, entityId, size = 24, color = '#DC2626' }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const key = `${entityType}:${entityId}`;

  useEffect(() => {
    // קודם טוען מ-AsyncStorage (מיידי)
    getLocalFavorites().then(favs => setSaved(!!favs[key]));
    // אחר כך מנסה לסנכרן מהשרת
    client.get(`/favorites/${entityType}/${entityId}`)
      .then(r => {
        setSaved(r.data.saved);
        setLocalFavorite(key, r.data.saved);
      })
      .catch(() => {}); // שרת לא זמין — נשאר עם הערך המקומי
  }, [entityType, entityId]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const newValue = !saved;
    // עדכון מיידי ב-UI + AsyncStorage
    setSaved(newValue);
    await setLocalFavorite(key, newValue);
    // מנסה לסנכרן לשרת (אופציונלי)
    client.post(`/favorites/${entityType}/${entityId}`)
      .catch(() => {}); // שרת לא זמין — לא נורא, נשמר מקומית
    setLoading(false);
  };

  return (
    <Pressable onPress={toggle} hitSlop={10} style={s.btn} disabled={loading}>
      <MaterialIcons
        name={saved ? 'favorite' : 'favorite-border'}
        size={size}
        color={saved ? color : '#ccc'}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({ btn: { padding: 4 } });

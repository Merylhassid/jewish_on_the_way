import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';

interface Props {
  entityType: 'restaurant' | 'synagogue';
  entityId: number;
  size?: number;
  color?: string;
}

export default function FavoriteButton({ entityType, entityId, size = 24, color = '#DC2626' }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    client.get(`/favorites/${entityType}/${entityId}`)
      .then(r => setSaved(r.data.saved))
      .catch(() => {});
  }, [entityType, entityId]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await client.post(`/favorites/${entityType}/${entityId}`);
      setSaved(r.data.saved);
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <Pressable onPress={toggle} hitSlop={10} style={s.btn} disabled={loading}>
      <MaterialIcons
        name={saved ? 'favorite' : 'favorite-border'}
        size={size}
        color={saved ? color : '#999'}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({ btn: { padding: 4 } });

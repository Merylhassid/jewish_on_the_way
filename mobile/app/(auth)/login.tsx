import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/src/store/auth';

export default function LoginScreen() {
  const { login, token, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && token) router.replace('/(tabs)');
  }, [token, authLoading]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      setError(null);
      setLoading(true);
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e?.message || e?.response?.data?.message || 'Invalid email or password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <Image source={require('@/assets/images/logo.jpeg')} style={styles.logo} />
          </View>
          <Text style={styles.appName}>Jewish On The Way</Text>
          <Text style={styles.appTagline}>Your Jewish travel companion</Text>
        </View>

        {/* ── Form sheet ── */}
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Welcome back</Text>
          <Text style={styles.sheetSub}>Sign in to continue</Text>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9AA8C0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#9AA8C0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Sign In</Text>}
          </Pressable>

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </Link>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Register</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C2461' },

  hero: {
    paddingTop: 88,
    paddingBottom: 44,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: { width: 60, height: 60, resizeMode: 'contain' },
  appName: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.2 },
  appTagline: { fontSize: 13, color: 'rgba(255,255,255,0.52)', marginTop: 7 },

  sheet: {
    flex: 1,
    backgroundColor: '#F2F5FB',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 26,
    paddingTop: 38,
    paddingBottom: 60,
  },
  sheetTitle: { fontSize: 26, fontWeight: '800', color: '#0C1A2E', marginBottom: 4 },
  sheetSub: { fontSize: 14, color: '#556080', marginBottom: 30 },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#556080',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: '#0C1A2E',
    borderWidth: 1.5,
    borderColor: '#E1E8F5',
    marginBottom: 22,
  },

  errorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: { color: '#D93025', fontSize: 13, textAlign: 'center' },

  primaryBtn: {
    backgroundColor: '#0C2461',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0C2461',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  forgotRow: { alignItems: 'center', paddingVertical: 10, marginBottom: 20 },
  forgotText: { color: '#0C2461', fontSize: 14, fontWeight: '600' },

  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#556080', fontSize: 14 },
  footerLink: { color: '#0C2461', fontWeight: '700', fontSize: 14 },
});

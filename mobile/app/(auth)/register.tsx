import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function RegisterScreen() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      await register(email.trim(), password, firstName.trim(), lastName.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e?.message || e?.response?.data?.message || 'Registration failed';
      Alert.alert('Registration Failed', msg);
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
            <Text style={styles.logoEmoji}>✡️</Text>
          </View>
          <Text style={styles.appName}>Jewish On The Way</Text>
          <Text style={styles.appTagline}>Your Jewish travel companion</Text>
        </View>

        {/* ── Form sheet ── */}
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Create Account</Text>
          <Text style={styles.sheetSub}>Join the community</Text>

          <View style={styles.nameRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#9AA8C0"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#9AA8C0"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.inputFull}
            placeholder="you@example.com"
            placeholderTextColor="#9AA8C0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.inputFull}
            placeholder="Min. 6 characters"
            placeholderTextColor="#9AA8C0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Create Account</Text>}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign In</Text>
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
    paddingTop: 72,
    paddingBottom: 38,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.2 },
  appTagline: { fontSize: 13, color: 'rgba(255,255,255,0.52)', marginTop: 7 },

  sheet: {
    flex: 1,
    backgroundColor: '#F2F5FB',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 60,
  },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: '#0C1A2E', marginBottom: 4 },
  sheetSub: { fontSize: 14, color: '#556080', marginBottom: 28 },

  nameRow: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

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
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 15,
    color: '#0C1A2E',
    borderWidth: 1.5,
    borderColor: '#E1E8F5',
    marginBottom: 20,
  },
  inputFull: {
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

  primaryBtn: {
    backgroundColor: '#0C2461',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0C2461',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#556080', fontSize: 14 },
  footerLink: { color: '#0C2461', fontWeight: '700', fontSize: 14 },
});

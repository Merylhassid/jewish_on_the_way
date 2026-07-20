import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { LockKeyhole, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { C } from '@/constants/theme';
import { useAuth } from '@/src/store/auth';

export type AuthReason =
  | 'account'
  | 'review'
  | 'report'
  | 'suggestPlace'
  | 'minyanCreate'
  | 'minyanJoin'
  | 'minyanChat'
  | 'community'
  | 'hosting';

interface RequireAuthOptions {
  reason?: AuthReason;
  returnTo?: string;
}

interface PromptState {
  reason: AuthReason;
  returnTo: string;
}

interface AuthPromptContextValue {
  requireAuth: (action: () => void, options?: RequireAuthOptions) => boolean;
  openAuthPrompt: (options?: RequireAuthOptions) => void;
}

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null);

const SAFE_RETURN_ROUTES = [
  /^\/\(tabs\)(?:\/|$)/,
  /^\/(?:destination|restaurant|restaurants|synagogue|synagogues|minyan|minyans|map|chat|hosting)(?:\/|$)/,
  /^\/(?:saved|blocked-users|admin)(?:\/|$)/,
];

export function safeReturnTo(candidate?: string) {
  if (!candidate || candidate.startsWith('//')) return '/(tabs)';
  const pathname = candidate.split('?')[0];
  return SAFE_RETURN_ROUTES.some(pattern => pattern.test(pathname)) ? candidate : '/(tabs)';
}

function navigateToAuth(pathname: '/(auth)/login' | '/(auth)/register', returnTo: string) {
  router.push({ pathname, params: { returnTo: safeReturnTo(returnTo) } } as any);
}

export function AuthPromptProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  const openAuthPrompt = useCallback((options: RequireAuthOptions = {}) => {
    setPrompt({
      reason: options.reason ?? 'account',
      returnTo: safeReturnTo(options.returnTo ?? pathname ?? '/(tabs)'),
    });
  }, [pathname]);

  const requireAuth = useCallback((action: () => void, options: RequireAuthOptions = {}) => {
    if (isAuthenticated) {
      action();
      return true;
    }
    openAuthPrompt(options);
    return false;
  }, [isAuthenticated, openAuthPrompt]);

  const value = useMemo(() => ({ requireAuth, openAuthPrompt }), [requireAuth, openAuthPrompt]);

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
      <Modal
        visible={Boolean(prompt)}
        transparent
        animationType="fade"
        onRequestClose={() => setPrompt(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modalCard} accessibilityViewIsModal>
            <View style={s.modalIcon}><LockKeyhole size={27} color={C.goldMuted} /></View>
            <Text style={s.modalTitle}>
              {t(`authPrompt.reasons.${prompt?.reason ?? 'account'}` as any)}
            </Text>
            <Text style={s.modalBody}>{t('authPrompt.body')}</Text>
            <Pressable
              style={s.primaryBtn}
              onPress={() => {
                const returnTo = prompt?.returnTo ?? '/(tabs)';
                setPrompt(null);
                navigateToAuth('/(auth)/register', returnTo);
              }}
            >
              <Text style={s.primaryText}>{t('authPrompt.register')}</Text>
            </Pressable>
            <Pressable
              style={s.secondaryBtn}
              onPress={() => {
                const returnTo = prompt?.returnTo ?? '/(tabs)';
                setPrompt(null);
                navigateToAuth('/(auth)/login', returnTo);
              }}
            >
              <Text style={s.secondaryText}>{t('authPrompt.login')}</Text>
            </Pressable>
            <Pressable style={s.notNowBtn} onPress={() => setPrompt(null)}>
              <Text style={s.notNowText}>{t('authPrompt.notNow')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AuthPromptContext.Provider>
  );
}

export function useRequireAuth() {
  const context = useContext(AuthPromptContext);
  if (!context) throw new Error('useRequireAuth must be used inside AuthPromptProvider');
  return context.requireAuth;
}

function ProtectedFeatureGate({ reason }: { reason: AuthReason }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={s.gateRoot}>
      <View style={s.gateCard}>
        <View style={s.gateIcon}><UserRound size={38} color={C.goldMuted} /></View>
        <Text style={s.gateTitle}>{t(`authPrompt.reasons.${reason}` as any)}</Text>
        <Text style={s.gateBody}>{t('authPrompt.protectedBody')}</Text>
        <Pressable style={s.primaryBtn} onPress={() => navigateToAuth('/(auth)/register', pathname)}>
          <Text style={s.primaryText}>{t('authPrompt.register')}</Text>
        </Pressable>
        <Pressable style={s.secondaryBtn} onPress={() => navigateToAuth('/(auth)/login', pathname)}>
          <Text style={s.secondaryText}>{t('authPrompt.login')}</Text>
        </Pressable>
        <Pressable style={s.notNowBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={s.notNowText}>{t('authPrompt.backToExplore')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function withProtectedRoute<P extends object>(
  Screen: React.ComponentType<P>,
  reason: AuthReason = 'account',
) {
  function ProtectedRoute(props: P) {
    const { sessionMode } = useAuth();

    if (sessionMode === 'loading') return <View style={s.loading} />;
    if (sessionMode !== 'authenticated') return <ProtectedFeatureGate reason={reason} />;
    return <Screen {...props} />;
  }

  ProtectedRoute.displayName = `withProtectedRoute(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return ProtectedRoute;
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: C.cream },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,23,54,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 22, padding: 24, alignItems: 'center' },
  modalIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.goldFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  modalTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 20, color: C.navy, textAlign: 'center', marginBottom: 8 },
  modalBody: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21, color: C.textSecondary, textAlign: 'center', marginBottom: 20 },
  primaryBtn: { width: '100%', borderRadius: 14, paddingVertical: 15, backgroundColor: C.navy, alignItems: 'center', marginBottom: 9 },
  primaryText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#fff' },
  secondaryBtn: { width: '100%', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: C.navy, alignItems: 'center' },
  secondaryText: { fontFamily: 'Inter-Bold', fontSize: 15, color: C.navy },
  notNowBtn: { paddingVertical: 13, paddingHorizontal: 16 },
  notNowText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.textMuted },
  gateRoot: { flex: 1, backgroundColor: C.cream, justifyContent: 'center', padding: 24 },
  gateCard: { backgroundColor: '#fff', borderRadius: 24, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: C.goldBorder },
  gateIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.goldFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  gateTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 22, color: C.navy, textAlign: 'center', marginBottom: 9 },
  gateBody: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 23, color: C.textSecondary, textAlign: 'center', marginBottom: 22 },
});

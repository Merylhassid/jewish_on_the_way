import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '@/constants/theme';

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message ?? 'Unknown error' };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', err, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.root}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.msg} numberOfLines={4}>{this.state.message}</Text>
        <Pressable style={s.btn} onPress={this.reset}>
          <Text style={s.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: C.bg },
  icon:    { fontSize: 48, marginBottom: 16 },
  title:   { fontFamily: 'Inter-Bold', fontSize: 20, color: C.textPrimary, marginBottom: 10 },
  msg:     { fontFamily: 'Inter-Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 28 },
  btn:     { backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { fontFamily: 'Inter-SemiBold', color: '#fff', fontSize: 15 },
});

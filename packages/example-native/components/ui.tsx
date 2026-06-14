import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export const colors = {
  bg: '#0b0b0f',
  card: '#16161d',
  border: '#26262f',
  text: '#f4f4f5',
  muted: '#8a8a99',
  accent: '#f4f4f5',
  accentText: '#0b0b0f',
  danger: '#ef4444',
  good: '#22c55e',
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'default',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'subtle';
}) {
  const palette =
    variant === 'danger'
      ? { bg: colors.danger, fg: '#fff', border: colors.danger }
      : variant === 'subtle'
        ? { bg: 'transparent', fg: colors.text, border: colors.border }
        : { bg: colors.accent, fg: colors.accentText, border: colors.accent };
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, gap: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  row: { gap: 2 },
  rowLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1 },
  rowValue: { color: colors.text, fontSize: 13, fontFamily: 'Courier' },
  field: { gap: 4 },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: 'Courier',
    fontSize: 13,
  },
  button: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13 },
});

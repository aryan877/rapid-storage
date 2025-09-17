import React from 'react';
import { View, ViewProps, useColorScheme } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export default function Card({ children, variant = 'default', style, ...props }: CardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const variants = {
    default:
      'rounded-2xl border border-gray-200/70 bg-white p-5 dark:border-white/10 dark:bg-white/5',
    elevated:
      'rounded-2xl border border-gray-200/60 bg-white p-5 dark:border-white/10 dark:bg-white/10',
    outlined:
      'rounded-2xl border border-gray-200/80 bg-transparent p-5 dark:border-white/10',
  };

  return (
    <View
      className={variants[variant]}
      style={[
        variant === 'default' &&
          (isDark
            ? { shadowColor: 'transparent' }
            : { shadowColor: '#0f172a0d', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }),
        variant === 'elevated' &&
          (isDark
            ? { shadowColor: 'transparent' }
            : { shadowColor: '#0f172a14', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 }),
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

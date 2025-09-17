import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ViewStyle,
  useColorScheme,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  className?: string;
}

export default function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  style,
  className,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const base = 'rounded-xl flex-row items-center justify-center';
  const variants: Record<Variant, string> = {
    primary: isDark ? 'bg-white' : 'bg-gray-900',
    secondary: isDark
      ? 'border border-white/10 bg-white/5'
      : 'border border-gray-300 bg-white',
    ghost: 'bg-transparent',
    danger: 'bg-rose-500',
  };
  const paddings: Record<Size, string> = {
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };
  const textColor = (() => {
    if (variant === 'primary') {
      return isDark ? 'text-gray-900' : 'text-white';
    }
    if (variant === 'secondary') {
      return isDark ? 'text-gray-100' : 'text-gray-900';
    }
    if (variant === 'danger') {
      return 'text-white';
    }
    return isDark ? 'text-gray-100' : 'text-gray-900';
  })();

  const spinnerColor = (() => {
    if (variant === 'primary') {
      return isDark ? '#111827' : '#ffffff';
    }
    if (variant === 'secondary') {
      return isDark ? '#f3f4f6' : '#111827';
    }
    if (variant === 'danger') {
      return '#ffffff';
    }
    return isDark ? '#f3f4f6' : '#111827';
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${paddings[size]} ${className ?? ''} ${
        disabled || loading ? 'opacity-60' : ''
      }`}
      style={style}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          leftIcon ?? null
        )}
        <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
        {rightIcon ?? null}
      </View>
    </Pressable>
  );
}

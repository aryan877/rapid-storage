import React from 'react';
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

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
  const baseClasses = 'flex-row items-center justify-center transition-all duration-200';

  const variants: Record<Variant, string> = {
    primary: 'bg-zinc-200 active:bg-zinc-300 shadow-lg',
    secondary: 'bg-zinc-900 border border-zinc-700 active:bg-zinc-800',
    outline: 'border border-zinc-700 bg-transparent active:bg-zinc-900',
    ghost: 'bg-transparent active:bg-zinc-900',
    danger: 'bg-zinc-900 border border-zinc-700 active:bg-zinc-800',
  };

  const sizes: Record<Size, string> = {
    sm: 'px-3 py-2 rounded-lg',
    md: 'px-4 py-3 rounded-xl',
    lg: 'px-6 py-4 rounded-2xl',
  };

  const textSizes: Record<Size, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const textColors: Record<Variant, string> = {
    primary: 'text-zinc-900 font-semibold',
    secondary: 'text-zinc-100 font-medium',
    outline: 'text-zinc-100 font-medium',
    ghost: 'text-zinc-100 font-medium',
    danger: 'text-zinc-100 font-semibold',
  };

  const spinnerColors: Record<Variant, string> = {
    primary: '#09090b',
    secondary: '#a1a1aa',
    outline: '#a1a1aa',
    ghost: '#a1a1aa',
    danger: '#a1a1aa',
  };

  const disabledClasses = disabled || loading ? 'opacity-50' : '';
  const combinedClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className || ''}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={combinedClasses}
      style={style}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColors[variant]} />
        ) : (
          (leftIcon ?? null)
        )}
        <Text className={`${textSizes[size]} ${textColors[variant]}`}>{title}</Text>
        {rightIcon ?? null}
      </View>
    </Pressable>
  );
}

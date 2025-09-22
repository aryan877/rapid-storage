import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
  className,
  ...props
}: CardProps) {
  const baseClasses = 'rounded-2xl';

  const variants = {
    default: 'bg-zinc-900 border border-zinc-800',
    elevated: 'bg-zinc-900 border border-zinc-800 shadow-lg',
    outlined: 'bg-transparent border-2 border-zinc-700',
    glass: 'bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-xl',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  const shadowStyles = {
    default: {},
    elevated: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
    outlined: {},
    glass: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
  };

  const combinedClasses = `${baseClasses} ${variants[variant]} ${paddings[padding]} ${className || ''}`;

  return (
    <View className={combinedClasses} style={[shadowStyles[variant], style]} {...props}>
      {children}
    </View>
  );
}

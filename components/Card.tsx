import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export default function Card({ children, variant = 'default', style, ...props }: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm',
    elevated: 'bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg',
    outlined:
      'bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800',
  };

  return (
    <View
      className={variants[variant]}
      style={[
        variant === 'default' && {
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          shadowOpacity: 0.05,
          elevation: 2,
        },
        variant === 'elevated' && {
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
          shadowOpacity: 0.1,
          elevation: 8,
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

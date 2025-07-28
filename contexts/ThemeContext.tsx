import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import React, { createContext, useContext, useEffect } from 'react';
import { View } from 'react-native';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  toggleColorScheme: () => void;
  setColorScheme: (scheme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setColorScheme(savedTheme);
        }
      } catch (error) {
        console.warn('Failed to load saved theme:', error);
      }
    };

    loadSavedTheme();
  }, [setColorScheme]);

  const handleSetColorScheme = async (scheme: 'light' | 'dark') => {
    setColorScheme(scheme);
    try {
      await AsyncStorage.setItem('theme', scheme);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  };

  const handleToggleColorScheme = async () => {
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    await handleSetColorScheme(newScheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme: colorScheme ?? 'light',
        setColorScheme: handleSetColorScheme,
        toggleColorScheme: handleToggleColorScheme,
      }}>
      <View className="flex-1">{children}</View>
    </ThemeContext.Provider>
  );
};

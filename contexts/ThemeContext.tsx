import React, { createContext, useContext } from 'react';
import { View } from 'react-native';

type ThemeContextType = {
  colorScheme: 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={{ colorScheme: 'dark' }}>
      <View className="flex-1 bg-zinc-950">{children}</View>
    </ThemeContext.Provider>
  );
};

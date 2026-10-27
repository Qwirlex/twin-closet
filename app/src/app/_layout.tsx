import { InterTight_300Light, InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold, useFonts } from '@expo-google-fonts/inter-tight';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppFrame } from '@/components/layout';
import { ShoppingProvider } from '@/lib/shopping';
import { StoreProvider } from '@/lib/store';
import { ThemeProvider, useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ InterTight_300Light, InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;
  return (
    <ThemeProvider>
      <StoreProvider>
        <ShoppingProvider>
          <Root />
        </ShoppingProvider>
      </StoreProvider>
    </ThemeProvider>
  );
}

function Root() {
  const { t } = useTheme();
  return (
    <AppFrame>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#1A1A1C' } }} />
        <Stack.Screen name="result" />
        <Stack.Screen name="twin" />
        <Stack.Screen name="stores" />
      </Stack>
    </AppFrame>
  );
}

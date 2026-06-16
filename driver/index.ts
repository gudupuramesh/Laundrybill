import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';

import App from './App';

// Keep native splash (app.json) visible until auth + onboarding gate resolve in App.tsx
void SplashScreen.preventAutoHideAsync();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a dev client,
// the environment is set up appropriately
registerRootComponent(App);

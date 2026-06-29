import { registerRootComponent } from 'expo';
import App from './App';

// Explicit entry (instead of expo/AppEntry) keeps root resolution stable
// inside the pnpm monorepo.
registerRootComponent(App);

import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/schibsted-grotesk';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import LandingLayout from './LandingLayout.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: LandingLayout,
} satisfies Theme;

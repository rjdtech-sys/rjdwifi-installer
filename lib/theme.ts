import { apiClient } from './api';

export type CustomThemeId = `custom-${string}`;

export type ThemeId = 'default' | 'neofi' | 'dark' | 'eco' | 'terminal' | CustomThemeId;

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  performanceScore: number;
  previewColors: string[];
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Classic Blue',
    description: 'Standard professional interface with balanced contrast.',
    performanceScore: 90,
    previewColors: ['#2563eb', '#f8fafc', '#0f172a']
  },
  {
    id: 'neofi',
    name: 'NeoFi Desktop',
    description: 'Light desktop-style admin with flat sidebar and soft cards.',
    performanceScore: 88,
    previewColors: ['#f3f4f6', '#ffffff', '#0f172a']
  },
  {
    id: 'dark',
    name: 'Midnight',
    description: 'High contrast dark mode, optimized for OLED and low light.',
    performanceScore: 92,
    previewColors: ['#1e293b', '#0f172a', '#38bdf8']
  },
  {
    id: 'eco',
    name: 'Eco Saver',
    description: 'Soft natural tones with reduced blue light emission.',
    performanceScore: 95,
    previewColors: ['#166534', '#f0fdf4', '#14532d']
  },
  {
    id: 'terminal',
    name: 'System Terminal',
    description: 'Ultra-lightweight, no gradients, minimal rendering cost.',
    performanceScore: 100,
    previewColors: ['#000000', '#22c55e', '#000000']
  }
];

export const ADMIN_THEME_KEY = 'rjd_pisowifi_theme';
export const CUSTOM_THEMES_KEY = 'rjd_pisowifi_custom_themes';
export const PORTAL_CONFIG_KEY = 'rjd_portal_config';

export interface CustomThemeValues {
  primary: string;
  primaryDark: string;
  bg: string;
  bgCard: string;
  textMain: string;
  textMuted: string;
  border: string;
  sidebarBg?: string;
  sidebarText?: string;
}

export interface StoredCustomTheme {
  id: CustomThemeId;
  name: string;
  values: CustomThemeValues;
}

export function getCustomThemes(): StoredCustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredCustomTheme[];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: StoredCustomTheme[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  apiClient.saveCustomThemes(themes).catch(e => console.error('Failed to sync custom themes:', e));
}

function applyCustomThemeValues(values: CustomThemeValues) {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--primary', values.primary);
  rootStyle.setProperty('--primary-dark', values.primaryDark);
  rootStyle.setProperty('--bg', values.bg);
  rootStyle.setProperty('--bg-card', values.bgCard);
  rootStyle.setProperty('--text-main', values.textMain);
  rootStyle.setProperty('--text-muted', values.textMuted);
  rootStyle.setProperty('--border', values.border);
  if (values.sidebarBg) {
    rootStyle.setProperty('--sidebar-bg', values.sidebarBg);
  } else {
    rootStyle.removeProperty('--sidebar-bg');
  }
   if (values.sidebarText) {
    rootStyle.setProperty('--sidebar-text', values.sidebarText);
  } else {
    rootStyle.removeProperty('--sidebar-text');
  }
}

function clearCustomThemeValues() {
  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty('--primary');
  rootStyle.removeProperty('--primary-dark');
  rootStyle.removeProperty('--bg');
  rootStyle.removeProperty('--bg-card');
  rootStyle.removeProperty('--text-main');
  rootStyle.removeProperty('--text-muted');
  rootStyle.removeProperty('--border');
  rootStyle.removeProperty('--sidebar-bg');
  rootStyle.removeProperty('--sidebar-text');
}

export type PortalThemeId =
  | 'default'
  | 'gaming'
  | 'nature'
  | 'school'
  | 'cyberpunk'
  | 'neon-arena'
  | 'space-wars'
  | 'retro-pixel'
  | 'dragon-fire'
  | 'custom-bg';

export interface PortalThemeConfig {
  id: PortalThemeId;
  name: string;
  description: string;
  previewColors: string[];
  /** CSS gradient/pattern used as the full-page background (no image file needed) */
  backgroundStyle?: string;
  /** Semi-transparent overlay colour placed on top of backgroundStyle / image */
  overlayColor?: string;
  /** 0-1 overlay opacity */
  overlayOpacity?: number;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent?: string;
  };
  buttonStyle: 'rounded' | 'square' | 'pill';
  customCss?: string;
}

export const PORTAL_THEMES: PortalThemeConfig[] = [
  {
    id: 'default',
    name: 'Classic Blue',
    description: 'Standard professional interface with balanced contrast.',
    previewColors: ['#2563eb', '#f8fafc', '#0f172a'],
    colors: {
      primary: '#2563eb',
      secondary: '#1e40af',
      background: '#f8fafc',
      text: '#0f172a'
    },
    buttonStyle: 'rounded'
  },
  {
    id: 'gaming',
    name: 'Gaming Arena',
    description: 'Vibrant neon colors with fully rounded buttons for gaming vibe.',
    previewColors: ['#7c3aed', '#ec4899', '#1e1b4b'],
    backgroundStyle: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)',
    overlayColor: 'rgba(30, 27, 75, 0.55)',
    overlayOpacity: 0.55,
    colors: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      background: '#1e1b4b',
      text: '#f8fafc',
      accent: '#22d3ee'
    },
    buttonStyle: 'pill',
    customCss: `
      .portal-btn { border-radius: 9999px !important; }
      .portal-card { border-radius: 24px !important; box-shadow: 0 0 30px rgba(124, 58, 237, 0.3) !important; background: rgba(30, 27, 75, 0.85) !important; backdrop-filter: blur(14px) !important; }
      .portal-header { border-radius: 0 0 40px 40px !important; background: linear-gradient(135deg, rgba(124,58,237,0.9), rgba(236,72,153,0.85)) !important; backdrop-filter: blur(10px) !important; }
      .rate-item { border-radius: 16px !important; border: 2px solid rgba(124, 58, 237, 0.3) !important; background: rgba(255,255,255,0.08) !important; }
    `
  },
  {
    id: 'nature',
    name: 'Nature Zen',
    description: 'Calming green tones inspired by forests and nature.',
    previewColors: ['#059669', '#10b981', '#ecfdf5'],
    backgroundStyle: 'linear-gradient(160deg, #064e3b 0%, #065f46 50%, #047857 100%)',
    overlayColor: 'rgba(6, 78, 59, 0.5)',
    overlayOpacity: 0.5,
    colors: {
      primary: '#059669',
      secondary: '#10b981',
      background: '#ecfdf5',
      text: '#064e3b',
      accent: '#84cc16'
    },
    buttonStyle: 'rounded',
    customCss: `
      .portal-btn { border-radius: 12px !important; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3) !important; }
      .portal-card { border-radius: 20px !important; background: rgba(255, 255, 255, 0.92) !important; backdrop-filter: blur(12px) !important; }
      .portal-header { border-radius: 0 0 30px 30px !important; background: linear-gradient(135deg, rgba(5,150,105,0.9) 0%, rgba(16,185,129,0.85) 100%) !important; }
      .rate-item { border-radius: 12px !important; background: rgba(255, 255, 255, 0.8) !important; backdrop-filter: blur(10px) !important; }
    `
  },
  {
    id: 'school',
    name: 'Academic Scholar',
    description: 'Clean navy and gold design perfect for educational institutions.',
    previewColors: ['#1e3a8a', '#f59e0b', '#fefce8'],
    backgroundStyle: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #1d4ed8 100%)',
    overlayColor: 'rgba(30, 58, 138, 0.5)',
    overlayOpacity: 0.5,
    colors: {
      primary: '#1e3a8a',
      secondary: '#f59e0b',
      background: '#fefce8',
      text: '#1e293b',
      accent: '#dc2626'
    },
    buttonStyle: 'square',
    customCss: `
      .portal-btn { border-radius: 4px !important; text-transform: uppercase !important; letter-spacing: 0.1em !important; }
      .portal-card { border-radius: 8px !important; border: 3px solid #1e3a8a !important; box-shadow: 4px 4px 0 #1e3a8a !important; background: rgba(255,255,255,0.95) !important; backdrop-filter: blur(10px) !important; }
      .portal-header { border-radius: 0 0 20px 20px !important; background: linear-gradient(135deg, rgba(30,58,138,0.9) 0%, rgba(59,130,246,0.85) 100%) !important; }
      .rate-item { border-radius: 4px !important; border: 2px solid #f59e0b !important; background: rgba(255,255,255,0.8) !important; }
    `
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Dark futuristic theme with glowing neon accents.',
    previewColors: ['#00ff9f', '#ff00ff', '#0a0a0a'],
    backgroundStyle: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
    overlayColor: 'rgba(10, 10, 10, 0.6)',
    overlayOpacity: 0.6,
    colors: {
      primary: '#00ff9f',
      secondary: '#ff00ff',
      background: '#0a0a0a',
      text: '#e0e0e0',
      accent: '#00ffff'
    },
    buttonStyle: 'pill',
    customCss: `
      .portal-btn { border-radius: 9999px !important; box-shadow: 0 0 15px rgba(0, 255, 159, 0.5) !important; text-shadow: 0 0 5px rgba(0, 255, 159, 0.8) !important; }
      .portal-card { border-radius: 16px !important; background: rgba(20, 20, 20, 0.9) !important; border: 1px solid rgba(0, 255, 159, 0.3) !important; box-shadow: 0 0 30px rgba(0, 255, 159, 0.2) !important; backdrop-filter: blur(14px) !important; }
      .portal-header { border-radius: 0 0 30px 30px !important; background: linear-gradient(135deg, rgba(26,26,46,0.95) 0%, rgba(22,33,62,0.9) 100%) !important; border-bottom: 2px solid #00ff9f !important; }
      .rate-item { border-radius: 12px !important; background: rgba(0, 255, 159, 0.1) !important; border: 1px solid rgba(0, 255, 159, 0.3) !important; }
    `
  },
  /* ───────── NEW GAMING THEMES ───────── */
  {
    id: 'neon-arena',
    name: 'Neon Arena',
    description: 'Electric neon grid with glowing arena vibes — perfect for FPS and MOBA gaming.',
    previewColors: ['#f0abfc', '#7dd3fc', '#0f0f23'],
    backgroundStyle:
      'radial-gradient(ellipse at 20% 80%, rgba(120,0,255,0.35) 0%, transparent 50%),' +
      'radial-gradient(ellipse at 80% 20%, rgba(0,200,255,0.3) 0%, transparent 50%),' +
      'linear-gradient(180deg, #0f0f23 0%, #1a0a2e 60%, #0d0d1f 100%)',
    overlayColor: 'rgba(15, 15, 35, 0.5)',
    overlayOpacity: 0.5,
    colors: {
      primary: '#a855f7',
      secondary: '#38bdf8',
      background: '#0f0f23',
      text: '#f0f9ff',
      accent: '#f0abfc'
    },
    buttonStyle: 'pill',
    customCss: `
      .portal-btn { border-radius: 9999px !important; box-shadow: 0 0 20px rgba(168,85,247,0.5) !important; }
      .portal-card { border-radius: 20px !important; background: rgba(15,15,35,0.88) !important; border: 1px solid rgba(168,85,247,0.4) !important; box-shadow: 0 0 40px rgba(168,85,247,0.15), inset 0 0 60px rgba(56,189,248,0.05) !important; backdrop-filter: blur(16px) !important; }
      .portal-header { border-radius: 0 0 36px 36px !important; background: linear-gradient(135deg, rgba(168,85,247,0.85) 0%, rgba(56,189,248,0.8) 100%) !important; box-shadow: 0 4px 30px rgba(168,85,247,0.4) !important; }
      .rate-item { border-radius: 14px !important; background: rgba(168,85,247,0.12) !important; border: 1px solid rgba(168,85,247,0.35) !important; }
      .session-timer { text-shadow: 0 0 20px rgba(168,85,247,0.6) !important; }
    `
  },
  {
    id: 'space-wars',
    name: 'Space Wars',
    description: 'Deep-space backdrop with nebula glow — for strategy and sci-fi gaming fans.',
    previewColors: ['#6366f1', '#818cf8', '#020617'],
    backgroundStyle:
      'radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.8), transparent),' +
      'radial-gradient(2px 2px at 40% 70%, rgba(255,255,255,0.6), transparent),' +
      'radial-gradient(1px 1px at 60% 20%, rgba(255,255,255,0.7), transparent),' +
      'radial-gradient(1px 1px at 80% 50%, rgba(255,255,255,0.5), transparent),' +
      'radial-gradient(ellipse at 70% 80%, rgba(99,102,241,0.3) 0%, transparent 60%),' +
      'linear-gradient(180deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
    overlayColor: 'rgba(2, 6, 23, 0.45)',
    overlayOpacity: 0.45,
    colors: {
      primary: '#6366f1',
      secondary: '#818cf8',
      background: '#020617',
      text: '#e0e7ff',
      accent: '#fbbf24'
    },
    buttonStyle: 'pill',
    customCss: `
      .portal-btn { border-radius: 9999px !important; box-shadow: 0 0 18px rgba(99,102,241,0.5) !important; }
      .portal-card { border-radius: 22px !important; background: rgba(2,6,23,0.87) !important; border: 1px solid rgba(99,102,241,0.4) !important; box-shadow: 0 0 50px rgba(99,102,241,0.12) !important; backdrop-filter: blur(16px) !important; }
      .portal-header { border-radius: 0 0 32px 32px !important; background: linear-gradient(135deg, rgba(99,102,241,0.88) 0%, rgba(129,140,248,0.8) 100%) !important; }
      .rate-item { border-radius: 12px !important; background: rgba(99,102,241,0.15) !important; border: 1px solid rgba(129,140,248,0.3) !important; }
      .session-timer { text-shadow: 0 0 18px rgba(99,102,241,0.7) !important; }
    `
  },
  {
    id: 'retro-pixel',
    name: 'Retro Pixel',
    description: '8-bit retro arcade aesthetic with chunky neon and scanline vibes.',
    previewColors: ['#22c55e', '#f97316', '#0c0a09'],
    backgroundStyle:
      'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px),' +
      'linear-gradient(180deg, #0c0a09 0%, #1c1917 50%, #292524 100%)',
    overlayColor: 'rgba(12, 10, 9, 0.4)',
    overlayOpacity: 0.4,
    colors: {
      primary: '#22c55e',
      secondary: '#f97316',
      background: '#0c0a09',
      text: '#f5f5f4',
      accent: '#fbbf24'
    },
    buttonStyle: 'square',
    customCss: `
      .portal-btn { border-radius: 2px !important; text-transform: uppercase !important; letter-spacing: 0.15em !important; font-family: 'Courier New', monospace !important; box-shadow: 4px 4px 0 rgba(34,197,94,0.5) !important; }
      .portal-card { border-radius: 4px !important; background: rgba(12,10,9,0.92) !important; border: 2px solid #22c55e !important; box-shadow: 6px 6px 0 rgba(34,197,94,0.3) !important; backdrop-filter: blur(8px) !important; }
      .portal-header { border-radius: 0 !important; background: linear-gradient(135deg, rgba(34,197,94,0.9) 0%, rgba(249,115,22,0.85) 100%) !important; border-bottom: 3px solid #f97316 !important; }
      .rate-item { border-radius: 4px !important; background: rgba(34,197,94,0.1) !important; border: 2px solid rgba(34,197,94,0.4) !important; font-family: 'Courier New', monospace !important; }
      .portal-title, .portal-subtitle { font-family: 'Courier New', monospace !important; }
    `
  },
  {
    id: 'dragon-fire',
    name: 'Dragon Fire',
    description: 'Blazing fire and dragon theme — intense reds and oranges for action gamers.',
    previewColors: ['#dc2626', '#f97316', '#1c0a0a'],
    backgroundStyle:
      'radial-gradient(ellipse at 50% 100%, rgba(220,38,38,0.35) 0%, transparent 60%),' +
      'radial-gradient(ellipse at 80% 0%, rgba(249,115,22,0.25) 0%, transparent 50%),' +
      'linear-gradient(180deg, #1c0a0a 0%, #2d0f0f 50%, #1a0505 100%)',
    overlayColor: 'rgba(28, 10, 10, 0.5)',
    overlayOpacity: 0.5,
    colors: {
      primary: '#dc2626',
      secondary: '#f97316',
      background: '#1c0a0a',
      text: '#fff7ed',
      accent: '#fbbf24'
    },
    buttonStyle: 'pill',
    customCss: `
      .portal-btn { border-radius: 9999px !important; box-shadow: 0 0 20px rgba(220,38,38,0.5) !important; }
      .portal-card { border-radius: 20px !important; background: rgba(28,10,10,0.88) !important; border: 1px solid rgba(220,38,38,0.45) !important; box-shadow: 0 0 40px rgba(220,38,38,0.18) !important; backdrop-filter: blur(16px) !important; }
      .portal-header { border-radius: 0 0 36px 36px !important; background: linear-gradient(135deg, rgba(220,38,38,0.9) 0%, rgba(249,115,22,0.85) 100%) !important; box-shadow: 0 4px 30px rgba(220,38,38,0.4) !important; }
      .rate-item { border-radius: 12px !important; background: rgba(220,38,38,0.12) !important; border: 1px solid rgba(249,115,22,0.35) !important; }
      .session-timer { text-shadow: 0 0 18px rgba(220,38,38,0.6) !important; }
    `
  }
];

export interface PortalConfig {
  title: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  theme: PortalThemeId;
  customCss?: string;
  customHtmlTop?: string;
  customHtmlBottom?: string;
  insertCoinAudio?: string;
  coinDropAudio?: string;
  connectedAudio?: string;
  macSyncEnabled: boolean;
  macSyncMode: 'fingerprint_mac' | 'session_token_mac';
  /** Uploaded background image URL (e.g. /uploads/backgrounds/xxx.jpg) */
  backgroundImage?: string;
  /** CSS gradient/pattern applied as body background (from theme or custom) */
  backgroundStyle?: string;
  /** Overlay colour on top of background image / gradient */
  overlayColor?: string;
  /** Overlay opacity 0-1 */
  overlayOpacity?: number;
}

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  title: 'RJD PISOWIFI',
  subtitle: 'Enterprise Internet Gateway',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  backgroundColor: '#f8fafc',
  textColor: '#0f172a',
  theme: 'default',
  customCss: '',
  customHtmlTop: '',
  customHtmlBottom: '',
  insertCoinAudio: '',
  coinDropAudio: '',
  connectedAudio: '',
  macSyncEnabled: false,
  macSyncMode: 'session_token_mac',
  backgroundImage: '',
  backgroundStyle: '',
  overlayColor: '',
  overlayOpacity: 0
};

export function applyPortalTheme(config: PortalConfig, themeId: PortalThemeId): PortalConfig {
  const theme = PORTAL_THEMES.find(t => t.id === themeId);
  if (!theme) return config;

  return {
    ...config,
    theme: themeId,
    primaryColor: theme.colors.primary,
    secondaryColor: theme.colors.secondary,
    backgroundColor: theme.colors.background,
    textColor: theme.colors.text,
    customCss: theme.customCss || '',
    backgroundStyle: theme.backgroundStyle || '',
    overlayColor: theme.overlayColor || '',
    overlayOpacity: theme.overlayOpacity ?? 0,
    /* keep existing uploaded image when switching themes; user can clear it manually */
    backgroundImage: config.backgroundImage || ''
  };
}

// --- Admin Theme Utilities ---

export function getStoredAdminTheme(): ThemeId {
  const stored = localStorage.getItem(ADMIN_THEME_KEY);
  return (stored as ThemeId) || 'default';
}

export function applyAdminTheme(themeId: ThemeId) {
  localStorage.setItem(ADMIN_THEME_KEY, themeId);
  const isCustom = typeof themeId === 'string' && themeId.startsWith('custom-');
  const baseTheme = isCustom ? 'default' : themeId;
  document.documentElement.setAttribute('data-theme', baseTheme);
  if (isCustom) {
    const custom = getCustomThemes().find(t => t.id === themeId);
    if (custom) {
      applyCustomThemeValues(custom.values);
    }
  } else {
    clearCustomThemeValues();
  }
}

export function setAdminTheme(themeId: ThemeId) {
  applyAdminTheme(themeId);
  apiClient.saveAdminTheme(themeId).catch(e => console.error('Failed to sync admin theme:', e));
}

export async function initAdminTheme() {
  const localTheme = getStoredAdminTheme();
  applyAdminTheme(localTheme);

  try {
    const [remoteTheme, remoteCustomThemes] = await Promise.all([
      apiClient.getAdminTheme(),
      apiClient.getCustomThemes()
    ]);

    if (remoteCustomThemes && Array.isArray(remoteCustomThemes)) {
       localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(remoteCustomThemes));
    }

    if (remoteTheme && remoteTheme !== localTheme) {
      applyAdminTheme(remoteTheme as ThemeId);
    }
  } catch (e) {
    // console.error('Failed to sync theme from server:', e);
  }
}

// --- Portal Config Utilities ---

export function getPortalConfig(): PortalConfig {
  try {
    const stored = localStorage.getItem(PORTAL_CONFIG_KEY);
    return stored ? { ...DEFAULT_PORTAL_CONFIG, ...JSON.parse(stored) } : DEFAULT_PORTAL_CONFIG;
  } catch (e) {
    return DEFAULT_PORTAL_CONFIG;
  }
}

export function setPortalConfig(config: PortalConfig) {
  localStorage.setItem(PORTAL_CONFIG_KEY, JSON.stringify(config));
}

export async function fetchPortalConfig(): Promise<PortalConfig> {
  try {
    const remote = await apiClient.getPortalConfig();
    if (remote && Object.keys(remote).length > 0) {
        const merged = { ...DEFAULT_PORTAL_CONFIG, ...remote };
        setPortalConfig(merged);
        return merged;
    }
    return getPortalConfig();
  } catch (e) {
    console.error('Failed to fetch portal config from server, using local', e);
    return getPortalConfig();
  }
}

export async function savePortalConfigRemote(config: PortalConfig) {
  setPortalConfig(config);
  await apiClient.savePortalConfig(config);
}

// Helper to apply portal config to CSS variables (if we decide to use them for portal too)
// For now, the Portal component will read this directly.
export function initTheme() {
  initAdminTheme();
}

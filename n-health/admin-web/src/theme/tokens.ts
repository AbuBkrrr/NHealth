// Design tokens - single source of truth for all UI values
// Usage: import { tokens } from '@design-system/tokens'

export const tokens = {
  // ==================== COLORS ====================
  colors: {
    // Primary (Blue - Trust, Medical)
    primary: {
      50: '#EBF5FF',
      100: '#D6EBFF',
      200: '#ADD6FF',
      300: '#85C1FF',
      400: '#5CAAFF',
      500: '#3B8FFF',
      600: '#2E6FCC',
      700: '#234F99',
      800: '#183066',
      900: '#0D1833',
    },

    // Success (Green - Positive, Verified)
    success: {
      50: '#E8F5E9',
      100: '#C8E6C9',
      200: '#A5D6A7',
      300: '#81C784',
      400: '#66BB6A',
      500: '#4CAF50',
      600: '#43A047',
      700: '#388E3C',
      800: '#2E7D32',
      900: '#1B5E20',
    },

    // Warning (Amber - Caution, Attention)
    warning: {
      50: '#FFF3E0',
      100: '#FFE0B2',
      200: '#FFCC80',
      300: '#FFB74D',
      400: '#FFA726',
      500: '#FF9800',
      600: '#FB8C00',
      700: '#F57C00',
      800: '#E65100',
      900: '#BF360C',
    },

    // Danger (Red - Urgent, Error)
    danger: {
      50: '#FFEBEE',
      100: '#FFCDD2',
      200: '#EF9A9A',
      300: '#E57373',
      400: '#EF5350',
      500: '#F44336',
      600: '#E53935',
      700: '#D32F2F',
      800: '#C62828',
      900: '#B71C1C',
    },

    // Info (Light Blue)
    info: {
      50: '#E1F5FE',
      100: '#B3E5FC',
      200: '#81D4FA',
      300: '#4FC3F7',
      400: '#29B6F6',
      500: '#03A9F4',
      600: '#039BE5',
      700: '#0288D1',
      800: '#0277BD',
      900: '#01579B',
    },

    // Grayscale
    gray: {
      0: '#FFFFFF',
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
      1000: '#000000',
    },

    // Semantic
    background: {
      primary: '#FFFFFF',
      secondary: '#F5F5F5',
      tertiary: '#EEEEEE',
    },
    text: {
      primary: '#212121',
      secondary: '#616161',
      tertiary: '#9E9E9E',
      disabled: '#BDBDBD',
      inverse: '#FFFFFF',
    },
    border: '#E0E0E0',
    divider: '#EEEEEE',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // ==================== TYPOGRAPHY ====================
  typography: {
    fontFamily: {
      base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
      '4xl': '40px',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: '-0.5px',
      normal: '0px',
      wide: '0.5px',
      wider: '1px',
    },
  },

  // ==================== SPACING ====================
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    9: '36px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },

  // ==================== BORDERS & RADIUS ====================
  borderRadius: {
    none: '0px',
    sm: '4px',
    base: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px',
  },

  borderWidth: {
    none: '0px',
    thin: '1px',
    base: '2px',
    thick: '3px',
  },

  // ==================== SHADOWS ====================
  shadows: {
    none: 'none',
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },

  // ==================== TRANSITIONS ====================
  transitions: {
    fast: '150ms ease-in-out',
    base: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },

  // ==================== Z-INDEX ====================
  zIndex: {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    backdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // ==================== BREAKPOINTS ====================
  breakpoints: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // ==================== MOTION ====================
  motion: {
    duration: {
      fast: '150ms',
      base: '250ms',
      slow: '350ms',
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      linear: 'linear',
    },
  },

  // ==================== ICON SIZES ====================
  iconSize: {
    xs: '16px',
    sm: '18px',
    base: '24px',
    md: '28px',
    lg: '32px',
    xl: '40px',
    '2xl': '48px',
  },

  // ==================== COMPONENT-SPECIFIC ====================
  components: {
    button: {
      height: {
        sm: '32px',
        base: '40px',
        lg: '48px',
      },
      padding: {
        sm: '8px 12px',
        base: '10px 16px',
        lg: '12px 24px',
      },
    },
    input: {
      height: {
        sm: '32px',
        base: '40px',
        lg: '48px',
      },
      padding: '12px 16px',
    },
    card: {
      padding: '16px',
      borderRadius: '12px',
    },
    modal: {
      borderRadius: '16px',
      maxWidth: '500px',
    },
  },
};

// Dark mode tokens
export const darkTokens = {
  colors: {
    ...tokens.colors,
    background: {
      primary: '#121212',
      secondary: '#1E1E1E',
      tertiary: '#2A2A2A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B3B3B3',
      tertiary: '#808080',
      disabled: '#616161',
      inverse: '#212121',
    },
    border: '#424242',
    divider: '#303030',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

// High contrast tokens
export const highContrastTokens = {
  colors: {
    ...tokens.colors,
    primary: {
      ...tokens.colors.primary,
      500: '#0000FF', // Pure blue
    },
    success: {
      ...tokens.colors.success,
      500: '#006600', // Pure green
    },
    danger: {
      ...tokens.colors.danger,
      500: '#CC0000', // Pure red
    },
  },
};

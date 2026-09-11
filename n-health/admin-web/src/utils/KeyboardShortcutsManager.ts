/**
 * Keyboard Shortcuts Manager for Admin Web
 * Enables power users to navigate and perform actions quickly via keyboard
 */

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  handler: () => void;
  enabled: boolean;
}

export class KeyboardShortcutsManager {
  private static shortcuts: Map<string, KeyboardShortcut> = new Map();
  private static enabled = true;

  /**
   * Initialize keyboard shortcuts
   * Call once on app startup
   */
  static initialize() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });

    this.registerDefaultShortcuts();
  }

  /**
   * Register a keyboard shortcut
   */
  static register(
    keys: string[],
    description: string,
    handler: () => void
  ): void {
    const key = this.normalizeKeys(keys);
    this.shortcuts.set(key, {
      keys,
      description,
      handler,
      enabled: true
    });
  }

  /**
   * Unregister a keyboard shortcut
   */
  static unregister(keys: string[]): void {
    const key = this.normalizeKeys(keys);
    this.shortcuts.delete(key);
  }

  /**
   * Enable/disable all shortcuts
   */
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get all registered shortcuts
   */
  static getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Handle key down event
   */
  private static handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Build key combination string
    const keys = [];
    if (event.ctrlKey) keys.push('ctrl');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');
    keys.push(event.key.toLowerCase());

    const keyCombo = this.normalizeKeys(keys);

    // Find and execute matching shortcut
    const shortcut = this.shortcuts.get(keyCombo);
    if (shortcut?.enabled) {
      event.preventDefault();
      shortcut.handler();
    }
  }

  /**
   * Normalize key array to string
   */
  private static normalizeKeys(keys: string[]): string {
    return keys.map(k => k.toLowerCase()).sort().join('+');
  }

  /**
   * Register default admin shortcuts
   */
  private static registerDefaultShortcuts(): void {
    // Navigation
    this.register(
      ['ctrl', 'd'],
      'Go to Dashboard',
      () => window.location.hash = '#/dashboard'
    );

    this.register(
      ['ctrl', 'u'],
      'Go to Users',
      () => window.location.hash = '#/users'
    );

    this.register(
      ['ctrl', 'a'],
      'Go to Admin Accounts',
      () => window.location.hash = '#/admin-accounts'
    );

    this.register(
      ['ctrl', 'l'],
      'Go to Audit Log',
      () => window.location.hash = '#/audit-log'
    );

    // Actions
    this.register(
      ['ctrl', 's'],
      'Save',
      () => {
        const saveButton = document.querySelector('[data-action="save"]') as HTMLButtonElement;
        saveButton?.click();
      }
    );

    this.register(
      ['ctrl', 'e'],
      'Export Data',
      () => {
        const exportButton = document.querySelector('[data-action="export"]') as HTMLButtonElement;
        exportButton?.click();
      }
    );

    this.register(
      ['escape'],
      'Close Dialog/Modal',
      () => {
        const closeButton = document.querySelector('[data-action="close"]') as HTMLButtonElement;
        closeButton?.click();
      }
    );

    this.register(
      ['ctrl', 'f'],
      'Focus Search',
      () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
    );

    // Help
    this.register(
      ['?'],
      'Show Shortcuts Help',
      () => this.showHelpDialog()
    );
  }

  /**
   * Show keyboard shortcuts help dialog
   */
  private static showHelpDialog(): void {
    const shortcuts = this.getShortcuts();
    const helpText = shortcuts
      .map(s => `${s.keys.join(' + ').toUpperCase()}: ${s.description}`)
      .join('\n');

    alert(`Keyboard Shortcuts:\n\n${helpText}`);
  }
}

export default KeyboardShortcutsManager;

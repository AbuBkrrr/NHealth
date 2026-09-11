import React, { ReactNode, CSSProperties } from 'react';
import { tokens } from '../theme/tokens';

// ==================== BUTTON COMPONENT ====================

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'base' | 'lg';
  isLoading?: boolean;
  isDisabled?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'base',
  isLoading = false,
  isDisabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
  onClick,
  className = '',
}) => {
  const variantStyles = {
    primary: `bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800`,
    secondary: `bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400`,
    danger: `bg-red-600 text-white hover:bg-red-700 active:bg-red-800`,
    success: `bg-green-600 text-white hover:bg-green-700 active:bg-green-800`,
    ghost: `bg-transparent text-blue-600 hover:bg-blue-50 active:bg-blue-100`,
  };

  const sizeStyles = {
    sm: `px-3 py-2 text-sm rounded-md`,
    base: `px-4 py-2.5 text-base rounded-lg`,
    lg: `px-6 py-3 text-lg rounded-xl`,
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold transition-all duration-250
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {isLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {!isLoading && icon && iconPosition === 'left' && icon}
      {children}
      {!isLoading && icon && iconPosition === 'right' && icon}
    </button>
  );
};

// ==================== CARD COMPONENT ====================

interface CardProps {
  variant?: 'elevated' | 'outlined' | 'flat';
  isClickable?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> & {
  Image: React.FC<{ src: string; alt: string }>;
  Badge: React.FC<{ label: string; variant: 'success' | 'warning' | 'danger' | 'info' }>;
  Content: React.FC<{ children: ReactNode }>;
  Actions: React.FC<{ children: ReactNode }>;
} = ({ variant = 'elevated', isClickable = false, onClick, children, className = '' }) => {
  const variantStyles = {
    elevated: `shadow-md bg-white`,
    outlined: `border border-gray-300 bg-white`,
    flat: `bg-gray-100`,
  };

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl p-4 transition-all duration-250
        ${variantStyles[variant]}
        ${isClickable ? 'cursor-pointer hover:shadow-lg' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

Card.Image = ({ src, alt }) => (
  <img src={src} alt={alt} className="w-full h-48 object-cover rounded-lg mb-3" />
);

Card.Badge = ({ label, variant }) => {
  const colors = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${colors[variant]} absolute top-2 right-2`}>
      {label}
    </span>
  );
};

Card.Content = ({ children }) => <div className="mb-3">{children}</div>;
Card.Actions = ({ children }) => <div className="flex gap-2 mt-4">{children}</div>;

// ==================== INPUT COMPONENT ====================

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  label,
  error,
  disabled,
  icon,
  className = '',
}) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-3 text-gray-500">{icon}</div>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={`
            w-full px-4 py-2.5 border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-all duration-250
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
        />
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
};

// ==================== BADGE COMPONENT ====================

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'base';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', size = 'base' }) => {
  const colors = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    base: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`inline-block font-semibold rounded-full ${colors[variant]} ${sizes[size]}`}>
      {label}
    </span>
  );
};

// ==================== MODAL COMPONENT ====================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  isDismissible?: boolean;
}

export const Modal: React.FC<ModalProps> & {
  Body: React.FC<{ children: ReactNode }>;
  Footer: React.FC<{ children: ReactNode }>;
} = ({ isOpen, onClose, title, children, size = 'md', isDismissible = true }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={isDismissible ? onClose : undefined} />
      <div className={`bg-white rounded-2xl shadow-xl ${sizes[size]} relative z-10 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {isDismissible && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

Modal.Body = ({ children }) => <div className="p-6">{children}</div>;
Modal.Footer = ({ children }) => (
  <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">{children}</div>
);

// ==================== TOAST COMPONENT ====================

interface ToastProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  onClose?: () => void;
  action?: ReactNode;
}

export const Toast: React.FC<ToastProps> = ({
  variant = 'info',
  title,
  message,
  duration = 3000,
  onClose,
  action,
}) => {
  React.useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'ℹ',
  };

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg border ${colors[variant]} shadow-lg animate-slide-up`}>
      <div className="flex items-start gap-3">
        <span className={`text-xl font-bold`}>{icons[variant]}</span>
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm opacity-90">{message}</p>
        </div>
        {action}
      </div>
    </div>
  );
};

// ==================== CHECKBOX COMPONENT ====================

interface CheckboxProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, disabled }) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-5 h-5 accent-blue-600 rounded cursor-pointer disabled:opacity-50"
      />
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
};

// ==================== SKELETON LOADER ====================

export const Skeleton: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
}) => (
  <div className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`} />
);

// ==================== SPINNER ====================

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizes[size]} border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin`} />
  );
};

// ==================== AVATAR COMPONENT ====================

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'circle' | 'square';
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  initials = '?',
  size = 'md',
  variant = 'circle',
}) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  const borderRadius = variant === 'circle' ? 'rounded-full' : 'rounded-lg';

  return (
    <div
      className={`
        flex items-center justify-center
        ${sizes[size]} ${borderRadius}
        bg-gradient-to-br from-blue-400 to-blue-600
        text-white font-semibold
      `}
    >
      {src ? <img src={src} alt={alt} className={`w-full h-full object-cover ${borderRadius}`} /> : initials}
    </div>
  );
};

// ==================== TAG COMPONENT ====================

interface TagProps {
  label: string;
  onRemove?: () => void;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const Tag: React.FC<TagProps> = ({ label, onRemove, variant = 'default' }) => {
  const colors = {
    default: 'bg-gray-200 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colors[variant]}`}>
      {label}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
          ✕
        </button>
      )}
    </div>
  );
};

// ==================== DIVIDER COMPONENT ====================

export const Divider: React.FC<{ label?: string; orientation?: 'horizontal' | 'vertical' }> = ({
  label,
  orientation = 'horizontal',
}) => {
  if (orientation === 'vertical') {
    return <div className="h-full w-px bg-gray-300" />;
  }

  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-300" />
      {label && <span className="text-sm text-gray-500 px-2">{label}</span>}
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );
};

// ==================== ALERT COMPONENT ====================

interface AlertProps {
  variant?: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description?: string;
  action?: ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, description, action }) => {
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  return (
    <div className={`p-4 border rounded-lg ${colors[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm opacity-90 mt-1">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
};

// ==================== PROGRESS BAR ====================

interface ProgressProps {
  value: number; // 0-100
  size?: 'sm' | 'base' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const Progress: React.FC<ProgressProps> = ({ value, size = 'base', variant = 'default' }) => {
  const sizes = {
    sm: 'h-1',
    base: 'h-2',
    lg: 'h-3',
  };

  const colors = {
    default: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  };

  return (
    <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizes[size]}`}>
      <div
        className={`${colors[variant]} h-full rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
};

// ==================== EMPTY STATE ====================

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-6xl mb-4">{icon}</div>
    <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
    {description && <p className="text-gray-600 mb-4 max-w-md">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default {
  Button,
  Card,
  Input,
  Badge,
  Modal,
  Toast,
  Checkbox,
  Skeleton,
  Spinner,
  Avatar,
  Tag,
  Divider,
  Alert,
  Progress,
  EmptyState,
};

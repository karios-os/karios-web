import React from 'react';
import Switch from 'react-switch';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  onColor?: string;
  offColor?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'medium',
  onColor = '#3CA6F2', // karios-blue
  offColor = '#E5E7EB', // light gray
  className = '',
  id,
  'aria-label': ariaLabel,
}) => {
  const getSizeProps = () => {
    switch (size) {
      case 'small':
        return { height: 20, width: 36, handleDiameter: 16 };
      case 'large':
        return { height: 28, width: 50, handleDiameter: 24 };
      default: // medium
        return { height: 24, width: 44, handleDiameter: 20 };
    }
  };

  const switchProps = {
    checked,
    onChange,
    disabled,
    onColor,
    offColor,
    onHandleColor: '#FFFFFF',
    offHandleColor: '#FFFFFF',
    handleDiameter: getSizeProps().handleDiameter,
    height: getSizeProps().height,
    width: getSizeProps().width,
    checkedIcon: false,
    uncheckedIcon: false,
    id,
    ['aria-label']: ariaLabel,
    borderRadius: getSizeProps().height / 2,
    activeBoxShadow: '0 0 2px 3px rgba(60, 166, 242, 0.3)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  } as any;

  return (
    <div className={className}>
      {React.createElement(Switch as any, {
        checked,
        onChange,
        disabled,
        onColor,
        offColor,
        onHandleColor: '#FFFFFF',
        offHandleColor: '#FFFFFF',
        handleDiameter: getSizeProps().handleDiameter,
        height: getSizeProps().height,
        width: getSizeProps().width,
        checkedIcon: false,
        uncheckedIcon: false,
        id,
        'aria-label': ariaLabel,
        borderRadius: getSizeProps().height / 2,
        activeBoxShadow: '0 0 2px 3px rgba(60, 166, 242, 0.3)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      })}
    </div>
  );
};

export default Toggle;

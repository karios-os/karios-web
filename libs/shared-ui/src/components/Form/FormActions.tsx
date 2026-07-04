import React from 'react';
import { Button } from './Button';

interface FormActionsProps {
  children?: React.ReactNode;
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  className = 'flex gap-4 pt-4',
}) => {
  return <div className={className}>{children}</div>;
};

import React from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  password: string;
  confirmPassword: string;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onErrorClear: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  password,
  confirmPassword,
  error,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onCancel,
  onErrorClear,
  title = 'Set Password',
  description = 'Password encrypts the bundle and is required to extract it.',
  submitLabel = 'Generate',
  cancelLabel = 'Cancel',
}) => {
  if (!isOpen) return null;

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPasswordChange(e.target.value);
    if (error) onErrorClear();
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfirmPasswordChange(e.target.value);
    if (error) onErrorClear();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="text-center">
        <h4 className="text-sm font-medium text-gray-900 mb-1">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Enter password"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue"
          required
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          placeholder="Confirm password"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue"
          required
        />
        {error && (
          <div className="p-2 rounded bg-red-50 text-red-700 text-xs border border-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-karios-blue hover:bg-karios-blue/90 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordModal;

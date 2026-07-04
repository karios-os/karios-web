import React from 'react';
import PasswordModal from '../../../shared-state/src/widgets/PasswordModal';
import PasswordSelection from '../../../shared-state/src/widgets/PasswordSelection';
import ActionButton from '../../../shared-state/src/widgets/ActionButton';
import ErrorMessage from '../../../shared-state/src/widgets/ErrorMessage';

interface SupportBundleTabProps {
  // Password selection modal state
  isPasswordSelectionOpen: boolean;
  onPasswordSelectionCancel: () => void;
  onSelectManualPassword: () => void;
  onSelectAutoPassword: (generatedPassword: string) => void;

  // Password modal state
  isPasswordModalOpen: boolean;
  password: string;
  confirmPassword: string;
  passwordError: string | null;

  // Bundle generation state
  isGenerating: boolean;
  isReady: boolean;
  isDownloading: boolean;
  isDownloaded: boolean;
  errorMessage: string | null;
  statusText: string;

  // Event handlers
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onPasswordSubmit: () => void;
  onPasswordCancel: () => void;
  onPasswordErrorClear: () => void;
  onButtonClick: () => void;

  className?: string;
}

const SupportBundleTab: React.FC<SupportBundleTabProps> = ({
  isPasswordSelectionOpen,
  onPasswordSelectionCancel,
  onSelectManualPassword,
  onSelectAutoPassword,
  isPasswordModalOpen,
  password,
  confirmPassword,
  passwordError,
  isGenerating,
  isReady,
  isDownloading,
  isDownloaded,
  errorMessage,
  statusText,
  onPasswordChange,
  onConfirmPasswordChange,
  onPasswordSubmit,
  onPasswordCancel,
  onPasswordErrorClear,
  onButtonClick,
  className = '',
}) => {
  // Button state logic
  const getButtonState = () => {
    if (isDownloaded) return { text: 'Downloaded', disabled: true, variant: 'success' as const };
    if (isDownloading)
      return { text: 'Downloading...', disabled: true, variant: 'processing' as const };
    if (isReady) return { text: 'Download Bundle', disabled: false, variant: 'download' as const };
    if (isGenerating) {
      // Show actual API status during polling
      const displayStatus =
        statusText === 'Generation started. Polling status...' ? 'Generating...' : statusText;
      return { text: displayStatus, disabled: true, variant: 'processing' as const };
    }
    return { text: 'Generate Bundle', disabled: false, variant: 'generate' as const };
  };

  const buttonState = getButtonState();

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Support Bundle</h2>
        <p className="text-sm text-gray-600">
          Collects system logs and diagnostic information, encrypts them, and packages them into a
          .7z archive for analysis by the support team.
        </p>
      </div>

      <div className="grid gap-4">
        {!isPasswordSelectionOpen && !isPasswordModalOpen ? (
          <div className="py-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">When to use</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Troubleshooting system issues</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Diagnostic analysis</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">System health evaluation</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Performance problem investigation</span>
              </div>
            </div>
          </div>
        ) : null}

        {isPasswordSelectionOpen && (
          <PasswordSelection
            isOpen={isPasswordSelectionOpen}
            onCancel={onPasswordSelectionCancel}
            onSelectManual={onSelectManualPassword}
            onSelectAuto={onSelectAutoPassword}
          />
        )}

        {isPasswordModalOpen && !isPasswordSelectionOpen && (
          <PasswordModal
            isOpen={isPasswordModalOpen}
            password={password}
            confirmPassword={confirmPassword}
            error={passwordError}
            onPasswordChange={onPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onSubmit={onPasswordSubmit}
            onCancel={onPasswordCancel}
            onErrorClear={onPasswordErrorClear}
            submitLabel="Generate Bundle"
          />
        )}

        {!isPasswordSelectionOpen && !isPasswordModalOpen && (
          <div className="flex items-center justify-center gap-3">
            <ActionButton
              text={buttonState.text}
              disabled={buttonState.disabled}
              variant={buttonState.variant}
              onClick={onButtonClick}
              isLoading={isGenerating || isDownloading}
            />
          </div>
        )}

        {errorMessage && <ErrorMessage message={errorMessage} className="mt-1" />}
      </div>
    </div>
  );
};

export default SupportBundleTab;

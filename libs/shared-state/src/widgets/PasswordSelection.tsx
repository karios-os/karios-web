import React, { useState } from 'react';
import { FaCopy, FaDownload } from 'react-icons/fa';

interface PasswordSelectionProps {
  isOpen: boolean;
  onCancel: () => void;
  onSelectManual: () => void;
  onSelectAuto: (generatedPassword: string) => void;
}

/**
 * Component to let user choose between manual password entry or auto-generated password
 */
const PasswordSelection: React.FC<PasswordSelectionProps> = ({
  isOpen,
  onCancel,
  onSelectManual,
  onSelectAuto,
}) => {
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showAutoMode, setShowAutoMode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  if (!isOpen) return null;

  // Generate a random password (8+ chars, mix of letters and numbers)
  const generateRandomPassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAutoGenerate = () => {
    const pwd = generateRandomPassword();
    setGeneratedPassword(pwd);
    setShowAutoMode(true);
  };

  const handleCopyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleDownloadPassword = () => {
    if (generatedPassword) {
      const element = document.createElement('a');
      const file = new Blob([`Support Bundle Password: ${generatedPassword}`], {
        type: 'text/plain',
      });
      element.href = URL.createObjectURL(file);
      element.download = `support-bundle-password.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
    }
  };

  const handleConfirmAutoPassword = () => {
    if (generatedPassword) {
      onSelectAuto(generatedPassword);
    }
  };

  const handleBack = () => {
    setShowAutoMode(false);
    setGeneratedPassword('');
    setCopyFeedback(false);
  };

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {!showAutoMode ? (
        <>
          {/* Mode Selection */}
          <div className="text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Password Method</h3>
            <p className="text-xs text-gray-500">Choose how to set the bundle password</p>
          </div>

          <div className="space-y-3">
            {/* Manual Password Button */}
            <button
              onClick={onSelectManual}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-karios-blue hover:bg-blue-50 transition-all text-left"
            >
              <h4 className="font-medium text-gray-900 mb-1">Manual Password</h4>
              <p className="text-xs text-gray-500">Enter your own password</p>
            </button>

            {/* Auto Generate Button */}
            <button
              onClick={handleAutoGenerate}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-karios-blue hover:bg-blue-50 transition-all text-left"
            >
              <h4 className="font-medium text-gray-900 mb-1">Auto Generated</h4>
              <p className="text-xs text-gray-500">Generate a random secure password</p>
            </button>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Auto-Generated Password Display */}
          <div className="text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Generated Password</h3>
            <p className="text-xs text-gray-500">
              Save this password securely - you`&apos;`ll need it to extract the bundle
            </p>
          </div>

          {/* Password Display Box */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedPassword}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-mono text-center"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyPassword}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FaCopy size={16} />
                <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadPassword}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FaDownload size={16} />
                <span>Download</span>
              </button>
            </div>

            {/* Info Text */}
            <p className="text-xs text-gray-600 text-center">
              The password has been copied to clipboard
            </p>
          </div>

          {/* Confirm Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleConfirmAutoPassword}
              className="px-6 py-3 bg-karios-blue hover:bg-karios-blue/90 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
            >
              Use This Password
            </button>
            <button
              onClick={handleBack}
              className="px-4 py-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PasswordSelection;

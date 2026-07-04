import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaEye, FaEyeSlash } from 'react-icons/fa';
import Modal from '../../shared-state/src/widgets/Modal';
import TwoFactorAuthModal from './TwoFactorAuthModal';
import envConfig from '../../../runtime-config';
import { createComponentLogger } from '@karios-monorepo/shared-state';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ForgotPasswordState {
  step: 'username' | '2fa' | 'new-password' | 'success';
  username: string;
  newPassword: string;
  confirmPassword: string;
  resetToken: string;
  userId: number | null;
  loading: boolean;
  error: string;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const logger = createComponentLogger('ForgotPasswordModal');

  const [state, setState] = useState<ForgotPasswordState>({
    step: 'username',
    username: '',
    newPassword: '',
    confirmPassword: '',
    resetToken: '',
    userId: null,
    loading: false,
    error: '',
    showNewPassword: false,
    showConfirmPassword: false,
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        step: 'username',
        username: '',
        newPassword: '',
        confirmPassword: '',
        resetToken: '',
        userId: null,
        loading: false,
        error: '',
        showNewPassword: false,
        showConfirmPassword: false,
      });
    }
  }, [isOpen]);

  // Decode JWT token to extract user_id
  const decodeToken = (token: string): { user_id: number } | null => {
    try {
      const payload = token.split('.')[1];
      const decodedPayload = atob(payload);
      const parsedPayload = JSON.parse(decodedPayload);

      // Handle different possible field names for user ID
      const userId = parsedPayload.user_id || parsedPayload.userId || parsedPayload.sub;

      if (userId !== undefined && userId !== null) {
        return { user_id: Number(userId) };
      }

      logger.error('No user ID found in token payload', { payload: parsedPayload });
      return null;
    } catch (error) {
      logger.error('Error decoding token', { error: error.message });
      return null;
    }
  };

  // Step 1: Send forgot password request
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.username.trim()) {
      setState((prev) => ({ ...prev, error: 'Username is required' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/password/forgot/${encodeURIComponent(state.username)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific error cases with user-friendly messages
        if (response.status === 404) {
          throw new Error('Incorrect username. Please check your username and try again.');
        } else if (response.status === 400) {
          throw new Error('Invalid request. Please check your username and try again.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(
            errorData.message || 'Failed to process password reset request. Please try again.'
          );
        }
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('No access token received');
      }

      // Decode token to get user_id
      const decodedData = decodeToken(data.access_token);
      if (!decodedData) {
        throw new Error('Failed to decode access token');
      }

      setState((prev) => ({
        ...prev,
        resetToken: data.access_token,
        userId: decodedData.user_id,
        step: '2fa',
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to send forgot password request',
        loading: false,
      }));
    }
  };

  // Handle 2FA completion
  const handle2FAComplete = (newToken: string) => {
    setState((prev) => ({
      ...prev,
      resetToken: newToken,
      step: 'new-password',
    }));
  };

  // Password validation function
  const validatePassword = (password: string): string => {
    if (!password) {
      return 'Password is required';
    }

    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('at least 8 characters');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('one number');
    }
    if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password)) {
      errors.push('one special character');
    }

    if (errors.length > 0) {
      return `Password must contain: ${errors.join(', ')}`;
    }

    return '';
  };

  // Step 3: Reset password
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const passwordError = validatePassword(state.newPassword);
    if (passwordError) {
      setState((prev) => ({ ...prev, error: passwordError }));
      return;
    }

    if (state.newPassword !== state.confirmPassword) {
      setState((prev) => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/user/password/reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.resetToken}`,
          },
          body: JSON.stringify({
            new_password: state.newPassword,
            user_id: state.userId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific error cases with user-friendly messages
        if (response.status === 401) {
          throw new Error('Session expired. Please restart the password reset process.');
        } else if (response.status === 400) {
          throw new Error(
            'Invalid password. Please check your password requirements and try again.'
          );
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(errorData.message || 'Failed to reset password. Please try again.');
        }
      }

      setState((prev) => ({
        ...prev,
        step: 'success',
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to reset password',
        loading: false,
      }));
    }
  };

  const handleInputChange = (field: keyof ForgotPasswordState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value, error: '' }));
  };

  const togglePasswordVisibility = (field: 'showNewPassword' | 'showConfirmPassword') => {
    setState((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const goBack = () => {
    if (state.step === '2fa') {
      setState((prev) => ({ ...prev, step: 'username' }));
    } else if (state.step === 'new-password') {
      setState((prev) => ({ ...prev, step: '2fa' }));
    }
  };

  const renderContent = () => {
    switch (state.step) {
      case 'username':
        return (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h2>
              <p className="text-gray-600">Enter your username to reset your password</p>
            </div>

            <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Username
                </label>
                <input
                  id="forgot-username"
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
                  placeholder="Enter your username"
                  value={state.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={state.loading}
                />
              </div>

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{state.error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={state.loading}
                className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 ${
                  state.loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {state.loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send Reset Request'
                )}
              </button>
            </form>
          </div>
        );

      case 'new-password':
        return (
          <div>
            <div className="flex items-center mb-6">
              <button
                onClick={goBack}
                className="mr-3 p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <FaArrowLeft />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
                <p className="text-gray-600">Enter your new password</p>
              </div>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={state.showNewPassword ? 'text' : 'password'}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pr-12"
                    placeholder="Enter new password"
                    value={state.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    disabled={state.loading}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('showNewPassword')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    {state.showNewPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={state.showConfirmPassword ? 'text' : 'password'}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pr-12"
                    placeholder="Confirm new password"
                    value={state.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    disabled={state.loading}
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (
                        e.ctrlKey &&
                        (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'x')
                      ) {
                        e.preventDefault();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('showConfirmPassword')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    {state.showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{state.error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={state.loading}
                className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 ${
                  state.loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {state.loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Resetting...</span>
                  </div>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful</h2>
              <p className="text-gray-600">
                Your password has been successfully reset. You can now sign in with your new
                password.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              Back to Sign In
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && state.step !== '2fa'}
        onClose={onClose}
        title=" " // Space ensures header is rendered with close button
        width="500px"
        closeOnOverlayClick={false}
      >
        <div className="p-6">{renderContent()}</div>
      </Modal>

      {/* 2FA Modal */}
      <TwoFactorAuthModal
        isOpen={state.step === '2fa'}
        onComplete={handle2FAComplete}
        customToken={state.resetToken}
        isPasswordReset={true}
      />
    </>
  );
};

export default ForgotPasswordModal;

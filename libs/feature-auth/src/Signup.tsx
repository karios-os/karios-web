import React, { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import {
  FaEye,
  FaEyeSlash,
  FaServer,
  FaCloud,
  FaShieldAlt,
  FaCog,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import { useAppState, createComponentLogger } from '@karios-monorepo/shared-state'; // Import the AppState context
import envConfig from '../../../runtime-config';

interface SignupForm {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirmPassword: string;
}

interface SignupErrors {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  confirmPassword?: string;
  submit?: string;
}

// Define the expected state type
interface SignupAppState {
  signupForm: SignupForm;
  signupErrors: SignupErrors;
  signupLoading: boolean;
  showPassword: boolean;
}

// Memoized slide component to prevent re-renders
const SlideContent = React.memo(
  ({
    slide,
  }: {
    slide: { icon: React.ReactNode; title: string; description: string; features: string[] };
  }) => (
    <div className="max-w-lg text-center text-white">
      <div className="mb-8 flex justify-center">{slide.icon}</div>

      <h1 className="text-4xl font-bold mb-6">{slide.title}</h1>

      <p className="text-xl text-white/80 mb-8 leading-relaxed">{slide.description}</p>

      <div className="space-y-3">
        {slide.features.map((feature, index) => (
          <div key={index} className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-white/90">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  )
);

SlideContent.displayName = 'SlideContent';

const Signup = (): React.JSX.Element => {
  const logger = createComponentLogger('Signup');
  const navigate = useNavigate();
  const {
    state,
    handleSignupFormChange,
    handleSignup,
    togglePasswordVisibility,
    clearSignupErrors,
  } = useAppState();

  // Local state for confirm password visibility and slides
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Local validation state for real-time password validation
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [localPasswordError, setLocalPasswordError] = useState<string>('');
  const [localConfirmPasswordError, setLocalConfirmPasswordError] = useState<string>('');
  const [localUsernameError, setLocalUsernameError] = useState<string>('');

  // Product slides data - memoized to prevent re-renders
  const slides = React.useMemo(
    () => [
      {
        icon: <FaServer className="text-6xl text-blue-500 mb-6" />,
        title: 'Hyperconverged Infrastructure',
        description:
          'Simplify your IT infrastructure with our all-in-one solution that combines compute, storage, and networking in a single platform.',
        features: ['Unified Management', 'Scalable Architecture', 'Cost Effective'],
      },
      {
        icon: <FaCloud className="text-6xl text-green-500 mb-6" />,
        title: 'Cloud-Native Virtualization',
        description:
          'Deploy and manage virtual machines with ease using our modern, cloud-native approach to virtualization.',
        features: ['Easy VM Management', 'High Availability', 'Resource Optimization'],
      },
      {
        icon: <FaShieldAlt className="text-6xl text-purple-500 mb-6" />,
        title: 'Enterprise Security',
        description:
          'Keep your data safe with enterprise-grade security features including encryption, access controls, and compliance tools.',
        features: ['Data Encryption', 'Role-Based Access', 'Compliance Ready'],
      },
      {
        icon: <FaCog className="text-6xl text-orange-500 mb-6" />,
        title: 'Automated Operations',
        description:
          'Reduce operational overhead with intelligent automation, monitoring, and self-healing capabilities.',
        features: ['Auto-scaling', 'Intelligent Monitoring', 'Self-healing Systems'],
      },
    ],
    []
  );

  // Username validation function - same as login page
  const validateUsername = (username: string): string => {
    if (!username.trim()) {
      return 'Username is required';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (username.length > 30) {
      return 'Username must be less than 30 characters';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return '';
  };

  // Password validation function - shows all requirements at once
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

  // Confirm password validation function
  const validateConfirmPassword = (password: string, confirmPassword: string): string => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return '';
  };

  // Handle username field blur (validation on focus loss)
  const handleUsernameBlur = () => {
    setTouchedFields((prev) => new Set(prev).add('username'));
    const usernameError = validateUsername(signupForm?.username || '');
    setLocalUsernameError(usernameError);
  };

  // Handle username field change (clear error on typing)
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear the local username error when user starts typing
    if (localUsernameError && touchedFields.has('username')) {
      setLocalUsernameError('');
    }
    // Call the original form change handler
    handleSignupFormChange(e);
  };

  // Handle password field blur (validation on focus loss)
  const handlePasswordBlur = () => {
    setTouchedFields((prev) => new Set(prev).add('password'));
    const passwordError = validatePassword(signupForm?.password || '');
    setLocalPasswordError(passwordError);

    // Also check confirm password if it's been touched and has a value
    if (touchedFields.has('confirmPassword') && signupForm?.confirmPassword) {
      const confirmError = validateConfirmPassword(
        signupForm?.password || '',
        signupForm?.confirmPassword || ''
      );
      setLocalConfirmPasswordError(confirmError);
    }
  };

  // Handle confirm password field blur
  const handleConfirmPasswordBlur = () => {
    setTouchedFields((prev) => new Set(prev).add('confirmPassword'));
    const confirmError = validateConfirmPassword(
      signupForm?.password || '',
      signupForm?.confirmPassword || ''
    );
    setLocalConfirmPasswordError(confirmError);
  };

  // Handle password field change (clear error on typing)
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear the local password error when user starts typing
    if (localPasswordError && touchedFields.has('password')) {
      setLocalPasswordError('');
    }
    // Also clear confirm password error if it exists, since the main password changed
    if (localConfirmPasswordError && touchedFields.has('confirmPassword')) {
      setLocalConfirmPasswordError('');
    }
    // Call the original form change handler
    handleSignupFormChange(e);
  };

  // Handle confirm password field change (clear error on typing)
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear the local confirm password error when user starts typing
    if (localConfirmPasswordError && touchedFields.has('confirmPassword')) {
      setLocalConfirmPasswordError('');
    }
    // Call the original form change handler
    handleSignupFormChange(e);
  };

  // Auto-advance slides - memoized callbacks to prevent re-renders
  const nextSlide = React.useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = React.useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, [slides.length]);

  // Clear any existing signup errors when component mounts
  useEffect(() => {
    if (clearSignupErrors) {
      clearSignupErrors();
    }
    // Also clear local validation state
    setLocalPasswordError('');
    setLocalConfirmPasswordError('');
    setLocalUsernameError('');
    setTouchedFields(new Set());
  }, []); // Empty dependency array to run only once on mount

  // Type the state variable with safe defaults
  const typedState = state as unknown as SignupAppState;
  const {
    signupForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      confirmPassword: '',
    },
    signupErrors = {},
    signupLoading = false,
    showPassword = false,
  } = typedState || {};

  // Check if form has any validation errors
  const hasValidationErrors = (): boolean => {
    const hasLocalErrors =
      (touchedFields.has('username') && localUsernameError) ||
      (touchedFields.has('password') && localPasswordError) ||
      (touchedFields.has('confirmPassword') && localConfirmPasswordError);

    const hasServerErrors =
      !!signupErrors?.username ||
      !!signupErrors?.email ||
      !!signupErrors?.first_name ||
      !!signupErrors?.last_name ||
      !!signupErrors?.password ||
      !!signupErrors?.confirmPassword;

    // Check if required fields are empty
    const hasEmptyRequiredFields =
      !signupForm?.username?.trim() ||
      !signupForm?.email?.trim() ||
      !signupForm?.first_name?.trim() ||
      !signupForm?.last_name?.trim() ||
      !signupForm?.password ||
      !signupForm?.confirmPassword;

    return !!hasLocalErrors || hasServerErrors || hasEmptyRequiredFields;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Prevent submission if there are validation errors
    if (hasValidationErrors()) {
      logger.warn('Form submission prevented due to validation errors');
      return;
    }

    if (handleSignup) {
      await handleSignup(e);
    } else {
      logger.error('handleSignup function is not available');
    }
  };

  // If the required functions are not available, show an error message
  if (!handleSignupFormChange || !handleSignup || !clearSignupErrors) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-center text-gray-900">Loading...</h2>
            <p className="text-center text-gray-600">
              Please wait while we initialize the signup form.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Side - Product Overview Slides */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-gray-800 via-gray-900 to-black relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='none' fill-rule='evenodd'%3e%3cg fill='%23ffffff' fill-opacity='0.05'%3e%3ccircle cx='30' cy='30' r='2'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e")`,
            }}
          />
        </div>

        {/* Slide Content */}
        <div className="flex-1 flex items-center justify-center p-12 z-10">
          <SlideContent slide={slides[currentSlide]} />
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors duration-200 z-20"
          aria-label="Previous slide"
        >
          <FaChevronLeft className="text-white text-lg" />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors duration-200 z-20"
          aria-label="Next slide"
        >
          <FaChevronRight className="text-white text-lg" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                index === currentSlide ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo - Always visible */}
          <div className="text-center">
            <img src="/Karios-2025.svg" alt="Karios Logo" className="h-42 w-auto mx-auto mb-2" />
            {envConfig().ENVIRONMENT !== 'production' && (
              <span className="text-sm text-gray-500">{envConfig().ENVIRONMENT}</span>
            )}
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create account</h2>
            <p className="text-gray-600">Sign up for your Karios account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" role="form" data-testid="signup-form">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={signupForm?.username || ''}
                onChange={handleUsernameChange}
                onBlur={handleUsernameBlur}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 ${
                  (touchedFields.has('username') && localUsernameError) || signupErrors?.username
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
                placeholder="Enter your username"
                required
                disabled={signupLoading}
              />
              {((touchedFields.has('username') && localUsernameError) ||
                signupErrors?.username) && (
                <p className="text-red-500 text-sm mt-1">
                  {touchedFields.has('username') && localUsernameError
                    ? localUsernameError
                    : signupErrors?.username}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={signupForm?.email || ''}
                onChange={handleSignupFormChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 ${signupErrors?.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                placeholder="Enter your email"
                required
                disabled={signupLoading}
              />
              {signupErrors?.email && (
                <p className="text-red-500 text-sm mt-1">{signupErrors.email}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  value={signupForm?.first_name || ''}
                  onChange={handleSignupFormChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 ${signupErrors?.first_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                  placeholder="First name"
                  required
                  disabled={signupLoading}
                />
                {signupErrors?.first_name && (
                  <p className="text-red-500 text-sm mt-1">{signupErrors.first_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  value={signupForm?.last_name || ''}
                  onChange={handleSignupFormChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 ${signupErrors?.last_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                  placeholder="Last name"
                  required
                  disabled={signupLoading}
                />
                {signupErrors?.last_name && (
                  <p className="text-red-500 text-sm mt-1">{signupErrors.last_name}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={signupForm?.password || ''}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pr-12 ${
                    (touchedFields.has('password') && localPasswordError) || signupErrors?.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                  required
                  disabled={signupLoading}
                  onCopy={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {((touchedFields.has('password') && localPasswordError) ||
                signupErrors?.password) && (
                <p className="text-red-500 text-sm mt-1">
                  {touchedFields.has('password') && localPasswordError
                    ? localPasswordError
                    : signupErrors?.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={signupForm?.confirmPassword || ''}
                  onChange={handleConfirmPasswordChange}
                  onBlur={handleConfirmPasswordBlur}
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
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pr-12 ${
                    (touchedFields.has('confirmPassword') && localConfirmPasswordError) ||
                    signupErrors?.confirmPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Confirm your password"
                  required
                  disabled={signupLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {((touchedFields.has('confirmPassword') && localConfirmPasswordError) ||
                signupErrors?.confirmPassword) && (
                <p className="text-red-500 text-sm mt-1">
                  {touchedFields.has('confirmPassword') && localConfirmPasswordError
                    ? localConfirmPasswordError
                    : signupErrors?.confirmPassword}
                </p>
              )}
            </div>

            {signupErrors?.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{signupErrors.submit}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={signupLoading || hasValidationErrors()}
              className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 ${
                signupLoading || hasValidationErrors() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {signupLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating account...</span>
                </div>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                logger.debug('Navigating to login page');
                // Clear errors before navigation
                if (clearSignupErrors) {
                  clearSignupErrors();
                }
                navigate('/login');
              }}
              className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;

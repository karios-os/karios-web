import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import { useAppState } from '@karios-monorepo/shared-state'; // Import the AppState context
import envConfig from '../../../runtime-config';
import TwoFactorAuthModal from './TwoFactorAuthModal';
import ForgotPasswordModal from './ForgotPasswordModal';

interface LoginForm {
  username: string;
  password: string;
}

interface ValidationErrors {
  username?: string;
  password?: string;
}

interface LoginProps {
  setLogin?: (value: boolean) => void;
}

interface LoginResult {
  success: boolean;
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

const Login = ({ setLogin }: LoginProps): React.JSX.Element => {
  const {
    state,
    handleLoginFormChange,
    togglePasswordVisibility,
    handleLogin,
    set2FACompleted,
    setAdditionalAuthRequired,
  } = useAppState();

  // Define the expected state type
  type LoginAppState = {
    loginForm: LoginForm;
    loginError: string;
    loginLoading: boolean;
    showPassword: boolean;
    twoFactorAuthRequired: boolean;
    twoFactorAuthCompleted: boolean;
  };

  // Type the state variable
  const typedState = state as unknown as LoginAppState;

  const { loginForm, loginError, loginLoading, showPassword, twoFactorAuthRequired } = typedState;

  // Local validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<keyof LoginForm>>(new Set());

  // Slides state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Forgot password modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

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

  // Validation functions
  const validateUsername = (username: string): string | undefined => {
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
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 1) {
      return 'Password cannot be empty';
    }
    return undefined;
  };

  // Validate form
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};

    errors.username = validateUsername(loginForm.username);
    errors.password = validatePassword(loginForm.password);

    return errors;
  };

  // Effect to validate form whenever form data changes
  useEffect(() => {
    const errors = validateForm();
    setValidationErrors(errors);
  }, [loginForm]);

  // Handle field blur to mark field as touched
  const handleFieldBlur = (fieldName: keyof LoginForm) => {
    setTouchedFields((prev) => new Set(prev).add(fieldName));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Mark all fields as touched when submitting
    const allFields = new Set<keyof LoginForm>(['username', 'password']);
    setTouchedFields(allFields);

    const errors = validateForm();
    setValidationErrors(errors);

    const hasErrors = Object.values(errors).some((error) => error !== undefined);
    if (hasErrors) {
      return;
    }

    const result: LoginResult = await handleLogin(e);
    // Only call setLogin if it exists and login was successful
    if (setLogin && result.success) {
      setLogin(true);
    }
  };

  // Handle 2FA completion
  const handle2FAComplete = () => {
    set2FACompleted(true);
    // Only call setLogin if it exists
    if (setLogin) {
      setLogin(true);
    }
  };

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

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo - Always visible */}
          <div className="text-center">
            <img src="/Karios-2025.svg" alt="Karios Logo" className="h-42 w-auto mx-auto mb-2" />
            {envConfig().ENVIRONMENT !== 'production' && (
              <span className="text-sm text-gray-500">{envConfig().ENVIRONMENT}</span>
            )}
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600">Sign in to your Karios account</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} role="form" data-testid="login-form">
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 ${
                    touchedFields.has('username') && validationErrors.username
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter your username"
                  value={loginForm.username}
                  onChange={handleLoginFormChange}
                  onBlur={() => handleFieldBlur('username')}
                  disabled={loginLoading}
                />
                {touchedFields.has('username') && validationErrors.username && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pr-12 ${
                      touchedFields.has('password') && validationErrors.password
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={handleLoginFormChange}
                    onBlur={() => handleFieldBlur('password')}
                    disabled={loginLoading}
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
                {touchedFields.has('password') && validationErrors.password && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>
                )}
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 ${
                loginLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loginLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>

            <div className="flex items-center justify-between text-center">
              <Link
                to="/signup"
                className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors duration-200"
              >
                New User? Create an account
              </Link>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors duration-200"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Two-Factor Authentication Modal */}
      <TwoFactorAuthModal
        isOpen={twoFactorAuthRequired}
        onComplete={handle2FAComplete}
        setAdditionalAuthRequired={setAdditionalAuthRequired}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};

export default Login;

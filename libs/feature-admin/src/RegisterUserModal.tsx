import React, { useState, useEffect } from 'react';
import { useAppState } from '@karios-monorepo/shared-state';
import { MdClose } from 'react-icons/md';
import { IoWarning } from 'react-icons/io5';
import { IoPerson } from 'react-icons/io5';

interface RegisterUserForm {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

interface ValidationErrors {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
}

interface RegisterUserModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

export default function RegisterUserModal({ onClose, onRefresh }: RegisterUserModalProps) {
  // Use shared state for user management
  const { state, handleRegisterFormChange, createUser } = useAppState();

  const {
    registerUserForm,
    userFormError,
  }: {
    registerUserForm: RegisterUserForm;
    userFormError: string | null;
  } = state;

  // Local validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isFormValid, setIsFormValid] = useState<boolean>(false);
  const [touchedFields, setTouchedFields] = useState<Set<keyof RegisterUserForm>>(new Set());

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

  const validateFirstName = (firstName: string): string | undefined => {
    if (!firstName.trim()) {
      return 'First name is required';
    }
    if (firstName.length < 2) {
      return 'First name must be at least 2 characters long';
    }
    if (firstName.length > 50) {
      return 'First name must be less than 50 characters';
    }
    if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
      return 'First name can only contain letters, spaces, apostrophes, and hyphens';
    }
    return undefined;
  };

  const validateLastName = (lastName: string): string | undefined => {
    if (!lastName.trim()) {
      return 'Last name is required';
    }
    if (lastName.length < 2) {
      return 'Last name must be at least 2 characters long';
    }
    if (lastName.length > 50) {
      return 'Last name must be less than 50 characters';
    }
    if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
      return 'Last name can only contain letters, spaces, apostrophes, and hyphens';
    }
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return undefined;
  };

  // Validate all fields
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};

    errors.username = validateUsername(registerUserForm.username);
    errors.first_name = validateFirstName(registerUserForm.first_name);
    errors.last_name = validateLastName(registerUserForm.last_name);
    errors.email = validateEmail(registerUserForm.email);
    errors.password = validatePassword(registerUserForm.password);

    return errors;
  };

  // Effect to validate form whenever form data changes
  useEffect(() => {
    const errors = validateForm();
    setValidationErrors(errors);

    // Check if form is valid (no errors)
    const hasErrors = Object.values(errors).some((error) => error !== undefined);
    setIsFormValid(!hasErrors);
  }, [registerUserForm]);

  // Handle field blur to mark field as touched
  const handleFieldBlur = (fieldName: keyof RegisterUserForm) => {
    setTouchedFields((prev) => new Set(prev).add(fieldName));
  };

  const handleRegister = async (): Promise<void> => {
    // Mark all fields as touched when submitting
    const allFields = new Set<keyof RegisterUserForm>([
      'username',
      'email',
      'first_name',
      'last_name',
      'password',
    ]);
    setTouchedFields(allFields);

    const errors = validateForm();
    setValidationErrors(errors);

    const hasErrors = Object.values(errors).some((error) => error !== undefined);
    if (hasErrors) {
      return;
    }

    const result = await createUser();
    if (result) {
      onRefresh();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center">
      {/* Blurred Background */}
      <div className="absolute inset-0 bg-opacity-50 backdrop-blur-sm"></div>
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md z-60 max-h-[90vh] overflow-y-auto">
        {/* Header with Icon and Close Button */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-blue-100 text-blue-600 p-2.5 rounded-lg flex-shrink-0 mt-0.5">
              <IoPerson size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Register New User</h2>
              <p className="text-sm text-gray-500 mt-1">
                Create a new user account with basic information
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="Close"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div className="px-6 py-6 space-y-5">
          {/* User Information Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">User Information</h3>

            {/* Username Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                name="username"
                type="text"
                placeholder="Enter username"
                value={registerUserForm.username}
                onChange={handleRegisterFormChange}
                onBlur={() => handleFieldBlur('username')}
                className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition text-sm ${
                  validationErrors.username && touchedFields.has('username')
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {validationErrors.username && touchedFields.has('username') && (
                <p className="text-red-500 text-xs mt-2">{validationErrors.username}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="text"
                placeholder="Enter email address"
                value={registerUserForm.email}
                onChange={handleRegisterFormChange}
                onBlur={() => handleFieldBlur('email')}
                className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition text-sm ${
                  validationErrors.email && touchedFields.has('email')
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {validationErrors.email && touchedFields.has('email') && (
                <p className="text-red-500 text-xs mt-2">{validationErrors.email}</p>
              )}
            </div>

            {/* First Name and Last Name Row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="first_name"
                  type="text"
                  placeholder="Enter first name"
                  value={registerUserForm.first_name}
                  onChange={handleRegisterFormChange}
                  onBlur={() => handleFieldBlur('first_name')}
                  className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition text-sm ${
                    validationErrors.first_name && touchedFields.has('first_name')
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {validationErrors.first_name && touchedFields.has('first_name') && (
                  <p className="text-red-500 text-xs mt-2">{validationErrors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="last_name"
                  type="text"
                  placeholder="Enter last name"
                  value={registerUserForm.last_name}
                  onChange={handleRegisterFormChange}
                  onBlur={() => handleFieldBlur('last_name')}
                  className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition text-sm ${
                    validationErrors.last_name && touchedFields.has('last_name')
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {validationErrors.last_name && touchedFields.has('last_name') && (
                  <p className="text-red-500 text-xs mt-2">{validationErrors.last_name}</p>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                name="password"
                type="password"
                placeholder="8+ chars, 1 number, 1 uppercase"
                value={registerUserForm.password}
                onChange={handleRegisterFormChange}
                onBlur={() => handleFieldBlur('password')}
                className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition text-sm ${
                  validationErrors.password && touchedFields.has('password')
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {validationErrors.password && touchedFields.has('password') && (
                <p className="text-red-500 text-xs mt-2">{validationErrors.password}</p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {userFormError && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-md p-3">
              <IoWarning className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-orange-700 text-sm font-medium">{userFormError}</p>
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRegister}
            disabled={!isFormValid}
            className={`px-5 py-2 text-white rounded-md font-medium text-sm transition-colors ${
              isFormValid
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

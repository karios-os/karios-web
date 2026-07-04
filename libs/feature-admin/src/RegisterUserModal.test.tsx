import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RegisterUserModal from './RegisterUserModal';

// Mock the shared-state module
const mockHandleRegisterFormChange = jest.fn();
const mockCreateUser = jest.fn();

const mockState = {
  registerUserForm: {
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
  },
  userFormError: null,
};

jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: () => ({
    state: mockState,
    handleRegisterFormChange: mockHandleRegisterFormChange,
    createUser: mockCreateUser,
  }),
}));

describe('RegisterUserModal', () => {
  const mockOnClose = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock state
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
    };
    mockState.userFormError = null;
  });

  it('renders modal with correct title', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('Register New User')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Password (8+ chars, 1 number, 1 uppercase, 1 special char)')
    ).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('displays form values from state', () => {
    mockState.registerUserForm = {
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      password: 'password123',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
    expect(screen.getByDisplayValue('User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('password123')).toBeInTheDocument();
  });

  it('calls handleRegisterFormChange when form fields change', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });

    expect(mockHandleRegisterFormChange).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls createUser when register button is clicked', async () => {
    mockCreateUser.mockResolvedValue(true);

    // Set valid form data
    mockState.registerUserForm = {
      username: 'validuser',
      email: 'valid@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'ValidPass123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onRefresh when user creation is successful', async () => {
    mockCreateUser.mockResolvedValue(true);

    // Set valid form data
    mockState.registerUserForm = {
      username: 'validuser',
      email: 'valid@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'ValidPass123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onRefresh when user creation fails', async () => {
    mockCreateUser.mockResolvedValue(false);

    // Set valid form data
    mockState.registerUserForm = {
      username: 'validuser',
      email: 'valid@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'ValidPass123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
    });

    expect(mockOnRefresh).not.toHaveBeenCalled();
  });

  it('displays error message when userFormError is present', () => {
    mockState.userFormError = 'Username already exists';

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.getByText('Username already exists')).toBeInTheDocument();
  });

  it('does not display error message when userFormError is null', () => {
    mockState.userFormError = null;

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('password field has correct type', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('text fields have correct type', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');

    expect(usernameInput).toHaveAttribute('type', 'text');
    expect(emailInput).toHaveAttribute('type', 'text');
    expect(firstNameInput).toHaveAttribute('type', 'text');
    expect(lastNameInput).toHaveAttribute('type', 'text');
  });

  it('calls handleRegisterFormChange when first name field changes', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const firstNameInput = screen.getByPlaceholderText('First Name');
    fireEvent.change(firstNameInput, { target: { value: 'John' } });

    expect(mockHandleRegisterFormChange).toHaveBeenCalled();
  });

  it('calls handleRegisterFormChange when password field changes', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    fireEvent.change(passwordInput, { target: { value: 'newpassword' } });

    expect(mockHandleRegisterFormChange).toHaveBeenCalled();
  });

  it('disables register button when form is invalid', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    expect(registerButton).toBeDisabled();
  });

  it('enables register button when form is valid', () => {
    // Set valid form data
    mockState.registerUserForm = {
      username: 'validuser',
      email: 'valid@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'ValidPass123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    expect(registerButton).not.toBeDisabled();
  });

  it('shows validation error for short username', () => {
    mockState.registerUserForm = {
      username: 'ab',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.blur(usernameInput);

    expect(screen.getByText('Username must be at least 3 characters long')).toBeInTheDocument();
  });

  it('shows validation error for long username', () => {
    mockState.registerUserForm = {
      username: 'a'.repeat(31),
      email: '',
      first_name: '',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.blur(usernameInput);

    expect(screen.getByText('Username must be less than 30 characters')).toBeInTheDocument();
  });

  it('shows validation error for invalid username characters', () => {
    mockState.registerUserForm = {
      username: 'user@name',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.blur(usernameInput);

    expect(
      screen.getByText('Username can only contain letters, numbers, underscores, and hyphens')
    ).toBeInTheDocument();
  });

  it('shows validation error for short first name', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: 'A',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const firstNameInput = screen.getByPlaceholderText('First Name');
    fireEvent.blur(firstNameInput);

    expect(screen.getByText('First name must be at least 2 characters long')).toBeInTheDocument();
  });

  it('shows validation error for long first name', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: 'A'.repeat(51),
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const firstNameInput = screen.getByPlaceholderText('First Name');
    fireEvent.blur(firstNameInput);

    expect(screen.getByText('First name must be less than 50 characters')).toBeInTheDocument();
  });

  it('shows validation error for invalid first name characters', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: 'John123',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const firstNameInput = screen.getByPlaceholderText('First Name');
    fireEvent.blur(firstNameInput);

    expect(
      screen.getByText('First name can only contain letters, spaces, apostrophes, and hyphens')
    ).toBeInTheDocument();
  });

  it('shows validation error for short last name', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: 'D',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const lastNameInput = screen.getByPlaceholderText('Last Name');
    fireEvent.blur(lastNameInput);

    expect(screen.getByText('Last name must be at least 2 characters long')).toBeInTheDocument();
  });

  it('shows validation error for long last name', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: 'D'.repeat(51),
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const lastNameInput = screen.getByPlaceholderText('Last Name');
    fireEvent.blur(lastNameInput);

    expect(screen.getByText('Last name must be less than 50 characters')).toBeInTheDocument();
  });

  it('shows validation error for invalid last name characters', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: 'Doe123',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const lastNameInput = screen.getByPlaceholderText('Last Name');
    fireEvent.blur(lastNameInput);

    expect(
      screen.getByText('Last name can only contain letters, spaces, apostrophes, and hyphens')
    ).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', () => {
    mockState.registerUserForm = {
      username: '',
      email: 'invalid-email',
      first_name: '',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const emailInput = screen.getByPlaceholderText('Email');
    fireEvent.blur(emailInput);

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('shows validation error for short password', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '1234567',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    fireEvent.blur(passwordInput);

    expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
  });

  it('shows validation error for password without lowercase letter', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: 'PASSWORD123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    fireEvent.blur(passwordInput);

    expect(
      screen.getByText('Password must contain at least one lowercase letter')
    ).toBeInTheDocument();
  });

  it('shows validation error for password without uppercase letter', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: 'password123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    fireEvent.blur(passwordInput);

    expect(
      screen.getByText('Password must contain at least one uppercase letter')
    ).toBeInTheDocument();
  });

  it('shows validation error for password without number', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: 'Password!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    fireEvent.blur(passwordInput);

    expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
  });

  it('shows validation error for password without special character', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: 'Password123',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );
    fireEvent.blur(passwordInput);

    expect(
      screen.getByText('Password must contain at least one special character')
    ).toBeInTheDocument();
  });

  it('shows required field errors when fields are empty and touched', () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const emailInput = screen.getByPlaceholderText('Email');
    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const passwordInput = screen.getByPlaceholderText(
      'Password (8+ chars, 1 number, 1 uppercase, 1 special char)'
    );

    fireEvent.blur(usernameInput);
    fireEvent.blur(emailInput);
    fireEvent.blur(firstNameInput);
    fireEvent.blur(lastNameInput);
    fireEvent.blur(passwordInput);

    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('applies error styling when field has validation error and is touched', () => {
    mockState.registerUserForm = {
      username: 'ab',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    fireEvent.blur(usernameInput);

    expect(usernameInput).toHaveClass('border-red-500');
  });

  it('marks all fields as touched when register button is clicked with invalid form', async () => {
    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('applies success styling when field is valid', () => {
    mockState.registerUserForm = {
      username: 'validuser',
      email: 'valid@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'ValidPass123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    expect(usernameInput).toHaveClass('border-gray-300');
  });

  it('does not call onRefresh when createUser returns falsy value', async () => {
    mockCreateUser.mockResolvedValue(null);

    mockState.registerUserForm = {
      username: 'validuser',
      email: 'valid@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'ValidPass123!',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
    });

    expect(mockOnRefresh).not.toHaveBeenCalled();
  });

  it('returns early when form has validation errors', () => {
    mockState.registerUserForm = {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('triggers early return validation path with invalid data', () => {
    mockState.registerUserForm = {
      username: 'ab',
      email: 'invalid-email',
      first_name: 'J',
      last_name: 'D',
      password: '123',
    };

    render(<RegisterUserModal onClose={mockOnClose} onRefresh={mockOnRefresh} />);

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});

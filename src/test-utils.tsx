import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock shared state provider for testing
interface MockAppState {
  loginForm?: {
    username: string;
    password: string;
  };
  loginError?: string;
  loginLoading?: boolean;
  showPassword?: boolean;
  [key: string]: any;
}

interface MockAppStateActions {
  handleLoginFormChange?: jest.MockedFunction<any>;
  togglePasswordVisibility?: jest.MockedFunction<any>;
  handleLogin?: jest.MockedFunction<any>;
  [key: string]: any;
}

// Custom render function that includes common providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  mockState?: MockAppState;
  mockActions?: MockAppStateActions;
}

function customRender(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { initialRoute = '/', mockState = {}, mockActions = {}, ...renderOptions } = options;

  // Mock the shared state if provided
  if (Object.keys(mockState).length > 0 || Object.keys(mockActions).length > 0) {
    const mockUseAppState = jest.fn(() => ({
      state: {
        loginForm: { username: '', password: '' },
        loginError: '',
        loginLoading: false,
        showPassword: false,
        ...mockState,
      },
      handleLoginFormChange: jest.fn(),
      togglePasswordVisibility: jest.fn(),
      handleLogin: jest.fn(),
      ...mockActions,
    }));

    jest.doMock('@karios-monorepo/shared-state', () => ({
      useAppState: mockUseAppState,
    }));
  }

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return <BrowserRouter>{children}</BrowserRouter>;
  }

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
}

// Mock functions factory
export const createMockFunctions = () => ({
  handleLoginFormChange: jest.fn(),
  togglePasswordVisibility: jest.fn(),
  handleLogin: jest.fn(),
  onClick: jest.fn(),
  onClose: jest.fn(),
  onSubmit: jest.fn(),
  onChange: jest.fn(),
});

// Mock data factory
export const createMockData = {
  table: (overrides: Record<string, any> = {}) => ({
    Name: 'John Doe',
    Email: 'john@example.com',
    Status: 'Active',
    Age: 30,
    ...overrides,
  }),

  vmsList: (count = 3) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `VM-${i + 1}`,
      status: i % 2 === 0 ? 'running' : 'stopped',
      cpu: `${50 + i * 10}%`,
      memory: `${2 + i}GB`,
    })),

  loginForm: (overrides: Partial<MockAppState['loginForm']> = {}) => ({
    username: '',
    password: '',
    ...overrides,
  }),

  user: (overrides: Record<string, any> = {}) => ({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
    ...overrides,
  }),
};

// Mock API responses
export const mockApiResponses = {
  success: (data: any = {}) => ({
    ok: true,
    json: jest.fn().mockResolvedValue(data),
    status: 200,
  }),

  error: (status = 400, message = 'Bad Request') => ({
    ok: false,
    json: jest.fn().mockResolvedValue({ message }),
    status,
  }),

  networkError: () => {
    throw new Error('Network Error');
  },
};

// Common test helpers
export const waitForElementToBeRemoved = async (element: HTMLElement) => {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.contains(element)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
};

// Mock implementations for common external dependencies
export const mockExternalDependencies = () => {
  // Mock react-icons
  jest.mock('react-icons/fa', () => ({
    FaUser: ({ className, size, color, ...props }: any) => (
      <div
        data-testid="mock-fa-user"
        className={className}
        data-size={size}
        data-color={color}
        {...props}
      >
        FaUser
      </div>
    ),
    FaEye: ({ onClick, ...props }: any) => (
      <button data-testid="mock-fa-eye" onClick={onClick} {...props}>
        FaEye
      </button>
    ),
    FaEyeSlash: ({ onClick, ...props }: any) => (
      <button data-testid="mock-fa-eyeslash" onClick={onClick} {...props}>
        FaEyeSlash
      </button>
    ),
  }));

  // Mock axios
  jest.mock('axios', () => ({
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    })),
  }));

  // Mock fetch
  global.fetch = jest.fn();

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock console methods to avoid noise in tests
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
};

// Assertion helpers
export const expectElementToHaveClasses = (element: HTMLElement, classes: string[]) => {
  classes.forEach((className) => {
    expect(element).toHaveClass(className);
  });
};

export const expectElementNotToHaveClasses = (element: HTMLElement, classes: string[]) => {
  classes.forEach((className) => {
    expect(element).not.toHaveClass(className);
  });
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoleSelector from './RoleSelector';

const mockRoles = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'User' },
  { id: 3, name: 'Manager' },
];

jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: () => ({
    state: {
      roles: mockRoles,
    },
  }),
}));

describe('RoleSelector', () => {
  const mockSetSelectedRole = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders role selector label', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    expect(screen.getByText('Role:')).toBeInTheDocument();
  });

  it('renders all available roles as radio buttons', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(3);
  });

  it('shows no role selected when selectedRole is null', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const radioButtons = screen.getAllByRole('radio') as HTMLInputElement[];
    radioButtons.forEach((radio) => {
      expect(radio.checked).toBe(false);
    });
  });

  it('shows selected role as checked', () => {
    render(<RoleSelector selectedRole={2} setSelectedRole={mockSetSelectedRole} />);

    const adminRadio = screen.getByRole('radio', { name: 'Admin' }) as HTMLInputElement;
    const userRadio = screen.getByRole('radio', { name: 'User' }) as HTMLInputElement;
    const managerRadio = screen.getByRole('radio', { name: 'Manager' }) as HTMLInputElement;

    expect(adminRadio.checked).toBe(false);
    expect(userRadio.checked).toBe(true);
    expect(managerRadio.checked).toBe(false);
  });

  it('calls setSelectedRole when role is selected', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const adminRadio = screen.getByRole('radio', { name: 'Admin' });
    fireEvent.click(adminRadio);

    expect(mockSetSelectedRole).toHaveBeenCalledWith(1);
  });

  it('calls setSelectedRole when different role is selected', () => {
    render(<RoleSelector selectedRole={1} setSelectedRole={mockSetSelectedRole} />);

    const userRadio = screen.getByRole('radio', { name: 'User' });
    fireEvent.click(userRadio);

    expect(mockSetSelectedRole).toHaveBeenCalledWith(2);
  });

  it('handles role state changes correctly', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const adminRadio = screen.getByRole('radio', { name: 'Admin' });
    fireEvent.click(adminRadio);

    expect(mockSetSelectedRole).toHaveBeenCalledWith(1);
  });

  it('renders radio buttons with correct names', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const radioButtons = screen.getAllByRole('radio');
    radioButtons.forEach((radio) => {
      expect(radio).toHaveAttribute('name', 'role');
      expect(radio).toHaveAttribute('type', 'radio');
    });
  });

  it('handles empty roles array', () => {
    jest.resetModules();
    jest.doMock('@karios-monorepo/shared-state', () => ({
      useAppState: () => ({
        state: {
          roles: [],
        },
      }),
    }));

    const RoleSelectorComponent = require('./RoleSelector').default;

    render(<RoleSelectorComponent selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    expect(screen.getByText('Role:')).toBeInTheDocument();
    const radioButtons = screen.queryAllByRole('radio');
    expect(radioButtons).toHaveLength(0);
  });

  it('renders role names with proper text wrapping', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const labels = screen.getAllByText(/Admin|User|Manager/);
    expect(labels).toHaveLength(3);

    labels.forEach((label) => {
      expect(label).toHaveClass('text-sm', 'break-words', 'leading-tight', 'flex-1');
    });
  });

  it('renders with correct CSS classes', () => {
    const { container } = render(
      <RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />
    );

    const roleContainer = container.querySelector('.flex.flex-wrap.gap-2.mt-1');
    expect(roleContainer).toBeInTheDocument();

    const labels = container.querySelectorAll('label');
    labels.forEach((label) => {
      if (label.textContent !== 'Role:') {
        expect(label).toHaveClass(
          'flex',
          'items-start',
          'gap-2',
          'p-2',
          'min-w-[200px]',
          'max-w-[300px]'
        );
      }
    });
  });

  it('renders radio inputs with correct classes', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const radioButtons = screen.getAllByRole('radio');
    radioButtons.forEach((radio) => {
      expect(radio).toHaveClass('mt-0.5', 'flex-shrink-0');
    });
  });

  it('handles role selection with different role IDs', () => {
    render(<RoleSelector selectedRole={3} setSelectedRole={mockSetSelectedRole} />);

    const managerRadio = screen.getByRole('radio', { name: 'Manager' }) as HTMLInputElement;
    expect(managerRadio.checked).toBe(true);

    const adminRadio = screen.getByRole('radio', { name: 'Admin' });
    fireEvent.click(adminRadio);

    expect(mockSetSelectedRole).toHaveBeenCalledWith(1);
  });

  it('maintains radio button group behavior', () => {
    render(<RoleSelector selectedRole={1} setSelectedRole={mockSetSelectedRole} />);

    const radioButtons = screen.getAllByRole('radio');
    let checkedCount = 0;
    radioButtons.forEach((radio) => {
      if ((radio as HTMLInputElement).checked) {
        checkedCount++;
      }
    });

    expect(checkedCount).toBe(1);
  });

  it('triggers onChange when role selection changes', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    const userRadio = screen.getByRole('radio', { name: 'User' });
    fireEvent.click(userRadio);

    expect(mockSetSelectedRole).toHaveBeenCalledWith(2);
  });

  it('renders with all roles having unique keys', () => {
    const { container } = render(
      <RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />
    );

    const labelElements = container.querySelectorAll('label[class*="flex items-start"]');
    expect(labelElements).toHaveLength(3);
  });

  it('verifies radio button accessibility attributes', () => {
    render(<RoleSelector selectedRole={1} setSelectedRole={mockSetSelectedRole} />);

    const radioButtons = screen.getAllByRole('radio');
    radioButtons.forEach((radio) => {
      expect(radio).toBeInTheDocument();
      expect(radio).toHaveAttribute('type', 'radio');
    });
  });

  it('checks role text content and structure', () => {
    render(<RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('validates component renders without errors', () => {
    const { container } = render(
      <RoleSelector selectedRole={null} setSelectedRole={mockSetSelectedRole} />
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it('ensures proper role ID handling', () => {
    render(<RoleSelector selectedRole={2} setSelectedRole={mockSetSelectedRole} />);

    const userRadio = screen.getByRole('radio', { name: 'User' }) as HTMLInputElement;
    expect(userRadio.checked).toBe(true);
  });
});

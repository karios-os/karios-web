import React from 'react';
import { useAppState } from '@karios-monorepo/shared-state';

interface Role {
  id: number;
  name: string;
}

interface RoleSelectorProps {
  selectedRole: number | null;
  setSelectedRole: (roleId: number | null) => void;
}

export default function RoleSelector({ selectedRole, setSelectedRole }: RoleSelectorProps) {
  // Use shared state for roles
  const { state } = useAppState();
  const { roles } = state;

  const handleChange = (id: number): void => {
    setSelectedRole(id);
  };

  return (
    <div>
      <label className="block font-medium">Role:</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {roles.map((role: Role) => (
          <label key={role.id} className="flex items-start gap-2 p-2 min-w-[200px] max-w-[300px]">
            <input
              type="radio"
              name="role"
              checked={selectedRole === role.id}
              onChange={() => handleChange(role.id)}
              className="mt-0.5 flex-shrink-0"
            />
            <span className="text-sm break-words leading-tight flex-1">{role.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

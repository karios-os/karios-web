import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import { IoCheckmark } from 'react-icons/io5';
import { MdInfoOutline } from 'react-icons/md';
import { MdLock } from 'react-icons/md';
import { MdPerson } from 'react-icons/md';
import { useAppState } from '@karios-monorepo/shared-state';

interface RoleFormProps {
  permissions?: any[];
}

export default function RoleForm({ permissions: passedPermissions }: RoleFormProps) {
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId?: string }>();

  const { state, updateRoleForm, clearRoleForm, togglePermission, saveRole, fetchPermissionsData } =
    useAppState();

  const { roleForm, editingRoleId, roles, permissions } = state;

  useEffect(() => {
    // Fetch permissions on mount
    fetchPermissionsData();

    if (roleId && roleId !== 'new') {
      // Load existing role for editing
      const role = roles.find((r) => r.id === parseInt(roleId));
      if (role) {
        // This will be handled by the parent component passing the role data
      }
    } else {
      // Clear form for new role
      clearRoleForm();
    }
  }, [roleId]);

  // Check if form is valid (all required fields populated)
  const isFormValid = () => {
    return (
      roleForm?.name?.trim() !== '' &&
      roleForm?.role?.trim() !== '' &&
      roleForm?.description?.trim() !== '' &&
      roleForm?.Permissions?.length > 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveRole();
    if (result?.success) {
      handleBack();
    }
  };

  const handleBack = () => {
    clearRoleForm();
    navigate(-1);
  };

  // Helper function to convert permission names to friendly display names
  const getFriendlyPermissionName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get Admin template permissions (example: VIEW and MANAGE permissions)
  const getAdminTemplatePermissions = () => {
    return permissions.filter((perm) => {
      const name = perm.name.toUpperCase();
      // Include MANAGE permissions and essential VIEW permissions
      return name.includes('MANAGE') || name.includes('ADMIN');
    });
  };

  // Check if Full Access is active
  const isFullAccessActive =
    permissions.length > 0 &&
    permissions.every((perm) => roleForm.Permissions.some((p) => p.id === perm.id));

  // Check if Admin template is active
  const adminTemplatePerms = getAdminTemplatePermissions();
  const isAdminTemplateActive =
    adminTemplatePerms.length > 0 &&
    adminTemplatePerms.every((perm) => roleForm.Permissions.some((p) => p.id === perm.id));

  return (
    <div className="w-full bg-white-50 min-h-screen">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm flex items-center gap-1"
          >
            <MdArrowBack size={18} /> <span className="hidden sm:inline">Back to roles</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2 sm:mt-3">
          {editingRoleId ? 'Edit Role' : 'Create New Role'}
        </h1>
      </div>

      {/* Content - Two Column Layout on Desktop, Stacked on Mobile */}
      <div className="flex flex-col lg:flex-row">
        {/* Left Sidebar - Permissions */}
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white-50 bg-gray-50">
          <div className="p-4 sm:p-6 sticky top-0 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-base sm:text-lg">Permissions</h3>
          </div>

          <div className="p-4 sm:p-6 bg-gray-50 max-h-[60vh] lg:max-h-screen overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {permissions.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-center p-2 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={roleForm.Permissions.some((p) => p.id === perm.id)}
                    onChange={() => togglePermission(perm.id, perm.name)}
                    className="accent-blue-600 w-4 h-4 cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {getFriendlyPermissionName(perm.name)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-gray-200 bg-white sticky bottom-0">
            <p className="text-xs sm:text-sm text-gray-600">
              Selected:{' '}
              <span className="font-semibold text-gray-900">{roleForm.Permissions.length}</span>
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full lg:w-2/3 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-white-50 max-h-screen overflow-y-auto"
        >
          {/* Basic Information Section */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6 pb-3 border-b border-gray-200">
              Basic Information
            </h2>

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Developer, Admin"
                  value={roleForm.name}
                  onChange={(e) => updateRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 sm:p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Role Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="role-slug-auto-generated"
                  value={roleForm.role}
                  onChange={(e) => updateRoleForm({ ...roleForm, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 sm:p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Slug is automatically generated from role name. Used for system identification.
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Provide a brief description of this role and its responsibilities..."
                  value={roleForm.description}
                  onChange={(e) =>
                    updateRoleForm({
                      ...roleForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md p-2 sm:p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs sm:text-sm"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Permissions & Access Control Info */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6 pb-3 border-b border-gray-200">
              Permissions & Access Control
            </h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <MdInfoOutline className="text-blue-600 text-lg mt-0.5" size={20} />
                <div>
                  <p className="text-sm text-blue-900 font-medium">
                    Select at least one permission
                  </p>
                  <p className="text-xs text-blue-800 mt-1">
                    Choose the permissions this role should have. You can select multiple
                    permissions across different categories from the left panel.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Templates Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
              Quick Templates
            </h2>
            <p className="text-sm text-gray-600 mb-4">Or choose a template to get started faster</p>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  // Check if all permissions are already selected
                  if (isFullAccessActive) {
                    // If all selected, deselect all
                    updateRoleForm({
                      ...roleForm,
                      Permissions: [],
                    });
                  } else {
                    // If not all selected, select all
                    updateRoleForm({
                      ...roleForm,
                      Permissions: permissions.map((p) => ({ id: p.id, name: p.name })),
                    });
                  }
                }}
                className={`border-2 rounded-lg p-5 text-left transition ${
                  isFullAccessActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <MdLock
                  className={`text-3xl ${isFullAccessActive ? 'text-blue-600' : 'text-gray-700'}`}
                />
                <p
                  className={`font-semibold mt-3 ${
                    isFullAccessActive ? 'text-blue-900' : 'text-gray-900'
                  }`}
                >
                  Full Access
                </p>
                <p className="text-xs text-gray-600">Complete control</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAdminTemplateActive) {
                    // If admin template active, deselect those permissions
                    const adminPerms = getAdminTemplatePermissions();
                    updateRoleForm({
                      ...roleForm,
                      Permissions: roleForm.Permissions.filter(
                        (p) => !adminPerms.some((ap) => ap.id === p.id)
                      ),
                    });
                  } else {
                    // If not active, select admin template permissions
                    const adminPerms = getAdminTemplatePermissions();
                    const newPermissions = [...roleForm.Permissions];
                    adminPerms.forEach((perm) => {
                      if (!newPermissions.some((p) => p.id === perm.id)) {
                        newPermissions.push({ id: perm.id, name: perm.name });
                      }
                    });
                    updateRoleForm({
                      ...roleForm,
                      Permissions: newPermissions,
                    });
                  }
                }}
                className={`border-2 rounded-lg p-5 text-left transition ${
                  isAdminTemplateActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <MdPerson
                  className={`text-3xl ${
                    isAdminTemplateActive ? 'text-blue-600' : 'text-gray-700'
                  }`}
                />
                <p
                  className={`font-semibold text-gray-900 mt-3 ${
                    isAdminTemplateActive ? 'text-blue-900' : 'text-gray-900'
                  }`}
                >
                  Admin
                </p>
                <p className="text-xs text-gray-600">Manage systems</p>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 sm:gap-3 pt-6 sm:pt-8 border-t border-gray-200 bg-white">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 sm:px-8 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 sm:px-8 py-2 rounded-md font-medium text-sm transition-colors ${
                isFormValid()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isFormValid()}
              title={
                !isFormValid() ? 'Please fill in all fields and select at least one permission' : ''
              }
            >
              {editingRoleId ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

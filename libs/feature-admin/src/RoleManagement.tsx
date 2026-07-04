import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiOutlineEdit } from 'react-icons/ai';
import { MdDeleteOutline } from 'react-icons/md';
import { IoSearch } from 'react-icons/io5';
import { MdAdd } from 'react-icons/md';
import {
  MdInfo,
  MdPeople,
  MdPerson,
  MdCheckCircle,
  MdCancel,
  MdSettingsSuggest,
  MdAdminPanelSettings,
  MdSecurity,
  MdBuild,
} from 'react-icons/md';
import { MdArrowUpward, MdArrowDownward } from 'react-icons/md';
import { useAppState } from '@karios-monorepo/shared-state';
import DataTable from '../../shared-state/src/widgets/DataTable';
import StatusCard from '../../shared-state/src/widgets/StatusCard';

export default function RoleManagement() {
  const navigate = useNavigate();
  const {
    state,
    fetchRolesData,
    fetchPermissionsData,
    removeRole,
    startEditingRole,
    clearRoleForm,
  } = useAppState();

  const { roles, permissions, editingRoleId } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [roleFilter, setRoleFilter] = useState<'all' | 'custom'>('all');

  const filteredRoles = roles
    .filter((role) => {
      // Apply search filter
      const matchesSearch =
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.role.toLowerCase().includes(searchTerm.toLowerCase());

      // Apply role type filter
      let matchesFilter = true;
      if (roleFilter === 'custom') {
        // Custom roles are user-created roles (not default/system roles)
        matchesFilter = !(role.is_default || role.default);
      }

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Calculate role metrics
  const totalRoles = roles.length;
  const customRoles = roles.filter((role) => {
    // Custom roles are user-created roles (not default/system roles)
    return !(role.is_default || role.default);
  }).length;

  // Column definitions for DataTable
  const columns: any[] = [
    // {
    //   key: 'index',
    //   header: 'S.No',
    //   className: 'px-4 py-2 text-gray-700 text-left text-sm font-medium bg-gray-50',
    //   headerClassName: 'px-4 py-2 text-left text-gray-900 text-sm font-semibold bg-white',
    //   render: (value: any, item: any, index?: number) => (index !== undefined ? index + 1 : '-')
    // },
    {
      key: 'name',
      header: (
        <div
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
        >
          <span>Name</span>
          {sortDirection === 'asc' ? <MdArrowUpward size={14} /> : <MdArrowDownward size={14} />}
        </div>
      ),
      className: 'px-4 py-2 text-gray-700 text-left text-sm bg-gray-50',
      headerClassName: 'px-4 py-2 text-left text-gray-900 text-sm font-semibold bg-white',
    },
    // {
    //   key: 'role',
    //   header: 'Slug',
    //   className: 'px-4 py-2 text-blue-600 text-left text-sm bg-gray-50',
    //   headerClassName: 'px-4 py-2 text-left text-gray-900 text-sm font-semibold bg-white',
    //   render: (value: any) => <span className="text-blue-600">{value}</span>
    // },
    {
      key: 'user_count',
      header: 'Total Users',
      className: 'px-4 py-2 text-gray-700 text-left text-sm bg-gray-50',
      headerClassName: 'px-4 py-2 text-left text-gray-900 text-sm font-semibold bg-white',
      render: (value: any) => value || 0,
    },
    {
      key: 'permissions',
      header: 'Permissions',
      className: 'px-4 py-2 text-gray-700 text-left text-sm bg-gray-50',
      headerClassName: 'px-4 py-2 text-left text-gray-900 text-sm font-semibold bg-white',
      render: (value: any, item: any) => item.permissions?.length || 0,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'px-4 py-2 text-left flex gap-2 bg-gray-50',
      headerClassName: 'px-4 py-2 text-left text-gray-900 text-sm font-semibold bg-white',
      render: (value: any, item: any) => (
        <div className="flex gap-2">
          <button
            disabled={item.is_default || item.default}
            className={`p-1.5 rounded transition-colors ${
              item.is_default || item.default
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
            onClick={() => {
              startEditingRole(item);
              navigate(`/role-management/${item.id}/edit`);
            }}
            title={item.is_default || item.default ? 'Cannot edit default role' : 'Edit role'}
          >
            <AiOutlineEdit size={18} />
          </button>
          <button
            disabled={item.is_default || item.default}
            className={`p-1.5 rounded transition-colors ${
              item.is_default || item.default
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:bg-red-50'
            }`}
            onClick={() => handleDelete(item.id)}
            title={item.is_default || item.default ? 'Cannot delete default role' : 'Delete role'}
          >
            <MdDeleteOutline size={18} />
          </button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    // Fetch roles and permissions when component mounts
    fetchRolesData();
    fetchPermissionsData();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      await removeRole(String(id));
    }
  };

  return (
    <div className="w-full min-h-screen">
      {/* Roles Header and Controls */}
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Roles ({filteredRoles.length})</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <input
              type="text"
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 sm:py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <IoSearch className="absolute right-2.5 top-2.5 sm:top-2 text-gray-400" size={16} />
          </div>

          <button
            onClick={() => {
              clearRoleForm();
              navigate('/role-management/new');
            }}
            className="px-4 py-2 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors flex items-center justify-center sm:justify-start gap-1.5"
          >
            <MdAdd size={16} /> Create Role
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <StatusCard
          metric={totalRoles.toString()}
          text="Total Roles"
          icon={MdPeople}
          iconColor="#3B82F6"
          iconSize={20}
          className={`bg-white border rounded-lg transition-shadow duration-200 hover:shadow-md ${
            roleFilter === 'all' ? 'border-blue-500 shadow-md' : 'border-gray-200'
          }`}
          metricsColor="text-gray-900"
          metricSize="text-base xl:text-xl"
          textSize="text-sm xl:text-base"
          textBesideIcon={true}
          onClick={() => {
            setRoleFilter('all');
            setSearchTerm('');
          }}
        />
        <StatusCard
          metric={customRoles.toString()}
          text="Custom Roles"
          icon={MdBuild}
          iconColor="#10B981"
          iconSize={20}
          className={`bg-white border rounded-lg transition-shadow duration-200 hover:shadow-md ${
            roleFilter === 'custom' ? 'border-green-500 shadow-md' : 'border-gray-200'
          }`}
          metricsColor="text-gray-900"
          metricSize="text-base xl:text-xl"
          textSize="text-sm xl:text-base"
          textBesideIcon={true}
          onClick={() => {
            setRoleFilter(roleFilter === 'custom' ? 'all' : 'custom');
            setSearchTerm('');
          }}
        />
      </div>

      {/* Table */}
      {filteredRoles.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p>No roles found</p>
        </div>
      ) : (
        <DataTable
          data={filteredRoles}
          columns={columns}
          hoverable={true}
          showAllData={true}
          className="bg-white"
          maxHeight="none"
          compact={true}
        />
      )}
    </div>
  );
}

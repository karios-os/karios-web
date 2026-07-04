import React from 'react';

interface CloudInitUserProps {
  cloudInitUsername: string;
  setCloudInitUsername: (value: string) => void;
  cloudInitPassword: string;
  setCloudInitPassword: (value: string) => void;
  cloudInitHashedPassword: string;
  setCloudInitHashedPassword: (value: string) => void;
  cloudInitSshKey: string;
  setCloudInitSshKey: (value: string) => void;
}

export default function CloudInitUser({
  cloudInitUsername,
  setCloudInitUsername,
  cloudInitPassword,
  setCloudInitPassword,
  cloudInitHashedPassword: _cloudInitHashedPassword,
  setCloudInitHashedPassword,
  cloudInitSshKey,
  setCloudInitSshKey,
}: CloudInitUserProps): React.ReactElement {
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setCloudInitPassword(password);
    // Set the hashed password to the same as the plain password
    setCloudInitHashedPassword(password);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const username = e.target.value;
    setCloudInitUsername(username);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-6">User Configuration</h2>

      {/* Cloud Init User Configuration */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">User Account Setup</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username * <span className="text-xs text-gray-500"></span>
            </label>
            <input
              type="text"
              id="username"
              value={cloudInitUsername}
              onChange={handleUsernameChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
              placeholder="Enter username"
            />
            <p className="mt-1 text-sm text-gray-600">Primary user account for the VM</p>
          </div>

          <div className="flex flex-col">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              id="password"
              value={cloudInitPassword}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
              placeholder="Enter password"
            />
            <p className="mt-1 text-sm text-gray-600">Password for the user account</p>
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor="sshKey" className="block text-sm font-medium text-gray-700 mb-2">
            SSH Public Key (Optional)
          </label>
          <textarea
            id="sshKey"
            value={cloudInitSshKey}
            onChange={(e) => setCloudInitSshKey(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue bg-white text-gray-900 text-sm resize-vertical"
            placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB..."
          />
          <p className="mt-1 text-sm text-gray-600">
            Add your SSH public key for passwordless authentication (recommended)
          </p>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Security Best Practices</h3>
            <div className="mt-2 text-sm text-green-700">
              <p>• Use a strong password with at least 6 characters</p>
              <p>• SSH keys provide more secure authentication than passwords</p>
              <p>• Consider disabling password authentication if using SSH keys</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

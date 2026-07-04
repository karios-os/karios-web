import React, { useEffect } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import {
  TopNavBar,
  Sidebar,
  VmTopBar,
  ServerTopBar,
  DataCenterTopBar,
  ClusterTopBar,
  VMSetup,
  K8sSetup,
  K8sProvisioningCenter,
  OmniProvisionPage,
  OmniVMProvisionPage,
  KubernetesDashboard,
  DistributionDetail,
} from '@karios-monorepo/feature-navigation';
import { MainContainer, Home, ScrollableContent } from '@karios-monorepo/shared-ui';
import { useAppState, ActionTypes, usePermissions, logger } from '@karios-monorepo/shared-state';
import {
  Login,
  Signup,
  AdditionalAuthModal,
} from '@karios-monorepo/feature-auth';
import {
  AccountInfo,
  RoleForm,
} from '@karios-monorepo/feature-admin';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


// Protected Route wrapper component
function ProtectedRoute({ children }) {
  const { isAuthenticated, isAuthLoading } = usePermissions();
  const { state } = useAppState();
  const { additionalAuthRequired, additionalAuthCompleted } = state;

  const location = useLocation();

  // Show loading screen while checking authentication
  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block access if additional authentication is required but not completed
  if (additionalAuthRequired && !additionalAuthCompleted) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Additional authentication required...</p>
        </div>
      </div>
    );
  }

  return children;
}

// Auth Route wrapper component (for login/signup pages)
function AuthRoute({ children }) {
  const { isAuthenticated, isAuthLoading } = usePermissions();
  const { state } = useAppState();
  const { additionalAuthRequired, additionalAuthCompleted } = state;

  const location = useLocation();

  // Show loading screen while checking authentication
  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && (!additionalAuthRequired || additionalAuthCompleted)) {
    // Redirect to home or the page they tried to visit only if no additional auth is needed
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return children;
}

export default function App() {
  const {
    state,
    dispatch,
    fetchInitialDataCenters,
    fetchVMsForServer,
    checkNodeStatuses,
    setAdditionalAuthCompleted,
  } = useAppState();

  const {
    dataCenters,
    selectedServer,
    selectedVm,
    activeComponent,
    selected_MainTopBar_Component,
    additionalAuthRequired,
    additionalAuthCompleted,
  } = state;

  const { isAuthenticated, isAuthLoading } = usePermissions();
  const location = useLocation();

  // Effect to fetch initial data centers and VMs for the default/selected server after login
  useEffect(() => {
    const serverAddress = selectedServer?.fqdn || selectedServer?.ip;
    if (serverAddress) {
      fetchInitialDataCenters(serverAddress);
    }
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Effect to handle component display based on TopNavBar selection
  useEffect(() => {
    if (selected_MainTopBar_Component) {
      dispatch({ type: ActionTypes.SET_ACTIVE_COMPONENT, payload: selected_MainTopBar_Component });
    }
  }, [selected_MainTopBar_Component]);

  // Effect to update selectedServer and selectedVm based on URL changes
  useEffect(() => {
    if (dataCenters && dataCenters.length > 0) {
      const pathParts = location.pathname.split('/');
      const serverNameFromUrl = pathParts.includes('server')
        ? pathParts[pathParts.indexOf('server') + 1]
        : null;
      const vmNameFromUrl = pathParts.includes('vm')
        ? pathParts[pathParts.indexOf('vm') + 1]
        : null;

      if (serverNameFromUrl && vmNameFromUrl) {
        // Handle server/vm combined route: /server/{serverName}/vm/{vmName}/...
        const server = dataCenters
          .flatMap((dc) => dc.servers)
          .find((s) => s.name === serverNameFromUrl);
        if (server) {
          // Set the server first
          if (!selectedServer || selectedServer.id !== server.id) {
            dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: server });
          }

          // If server has VMs loaded, find and set the VM
          if (server.vms && server.vms.length > 0) {
            const vm = server.vms.find((v) => v.name === vmNameFromUrl);
            if (vm && (!selectedVm || selectedVm.name !== vm.name)) {
              dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: vm });
            }
          } else {
            // Server doesn't have VMs loaded, fetch them first
            fetchVMsForServer(server)
              .then(() => {
                // After fetching, the useEffect will run again and find the VM
              })
              .catch((error) => {
                logger.error(`Failed to fetch VMs for server ${server.name}`, error);
              });
          }
        }
      } else if (vmNameFromUrl) {
        // Legacy VM-only route handling: /vm/{vmName}/...
        const allVMs = dataCenters
          .flatMap((dc) => dc.servers)
          .flatMap((server) => server.vms || []);
        const vm = allVMs.find((v) => v.name === vmNameFromUrl);
        if (vm && (!selectedVm || selectedVm.name !== vm.name)) {
          dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: vm });
          const parentServer = dataCenters
            .flatMap((dc) => dc.servers)
            .find((server) => server.vms?.some((serverVm) => serverVm.name === vmNameFromUrl));
          if (parentServer && (!selectedServer || selectedServer.id !== parentServer.id)) {
            dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: parentServer });
          }
        }
      } else if (serverNameFromUrl) {
        // Server-only route handling: /server/{serverName}/...
        const server = dataCenters
          .flatMap((dc) => dc.servers)
          .find((s) => s.name === serverNameFromUrl);
        if (server && (!selectedServer || selectedServer.id !== server.id)) {
          dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: server });
        }
      }
    }
  }, [location.pathname, dataCenters]);

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <AuthRoute>
              <Signup />
            </AuthRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <AppContent
                dataCenters={dataCenters}
                selectedServer={selectedServer}
                selectedVm={selectedVm}
                activeComponent={activeComponent}
                fetchVMsForServer={fetchVMsForServer}
                dispatch={dispatch}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        style={{ zIndex: 9999999 }}
        toastStyle={{ zIndex: 9999999 }}
      />

      {/* Additional Authentication Modal - Always render when required */}
      <AdditionalAuthModal
        isOpen={additionalAuthRequired && !additionalAuthCompleted}
        onComplete={() => setAdditionalAuthCompleted(true)}
      />

    </>
  );
}

// Move the conditional routing logic to a separate component
function AppContent({
  dataCenters,
  selectedServer,
  selectedVm,
  activeComponent,
  fetchVMsForServer,
  dispatch,
}) {
  // Get the first datacenter ID dynamically, fallback to "1" if no datacenters
  const firstDataCenterId = dataCenters && dataCenters.length > 0 ? dataCenters[0].id : '1';

  // State to track sidebar width for content adjustment
  // Initialize with 32px (small sidebar width) to avoid layout shift on refresh
  const [sidebarWidth, setSidebarWidth] = React.useState(32);

  // Callback to handle sidebar state changes
  const handleSidebarStateChange = (state: 'hidden' | 'small' | 'expanded', width: number) => {
    setSidebarWidth(width);
  };

  return (
    <>
      <div className="flex flex-col h-screen w-screen overflow-auto">
        {/* Fixed TopNavBar */}
        <TopNavBar sidebarWidth={sidebarWidth} />
        <div className="flex flex-1 w-full overflow-hidden" style={{ marginTop: '60px' }}>
          <Sidebar onSidebarStateChange={handleSidebarStateChange} />
          <MainContainer sidebarWidth={sidebarWidth}>
            {activeComponent}
            <Routes>
              <Route
                path="/"
                element={<Navigate to={`/dc/${firstDataCenterId}/stats`} replace />}
              />
              <Route
                path="/vm-setup"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <VMSetup
                      dataCenters={dataCenters}
                      fetchVMs={fetchVMsForServer}
                      setSelectedVm={(vm) =>
                        dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: vm })
                      }
                    />
                  </ScrollableContent>
                }
              />
              <Route
                path="/set-k8s"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <K8sSetup dataCenters={dataCenters} />
                  </ScrollableContent>
                }
              />
              <Route
                path="/k8s-provisioning"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <K8sProvisioningCenter />
                  </ScrollableContent>
                }
              />
              <Route
                path="/kubernetes-dashboard"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <KubernetesDashboard />
                  </ScrollableContent>
                }
              />
              <Route
                path="/kubernetes-dashboard/:distributionName"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <DistributionDetail />
                  </ScrollableContent>
                }
              />
              <Route path="/omni-provision" element={<OmniProvisionPage />} />
              <Route path="/provision/omni-vm" element={<OmniVMProvisionPage />} />
              <Route path="/provision/omni" element={<OmniProvisionPage />} />
              <Route
                path="/role-management/new"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <RoleForm permissions={[]} />
                  </ScrollableContent>
                }
              />
              <Route
                path="/role-management/:roleId/edit"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <RoleForm permissions={[]} />
                  </ScrollableContent>
                }
              />
              <Route
                path="/account-info/*"
                element={
                  <ScrollableContent hasTopBar={false}>
                    <AccountInfo />
                  </ScrollableContent>
                }
              />
              <Route path="/dc/:dcId/*" element={<DataCenterTopBar />} />
              <Route path="/cluster/:clusterName/*" element={<ClusterTopBar />} />
              {selectedServer && (
                <Route
                  path={`/server/${selectedServer.name}/*`}
                  element={<ServerTopBar key={selectedServer.name} />}
                />
              )}
              {selectedServer && selectedVm && (
                <Route
                  path={`/server/${selectedServer.name}/vm/${selectedVm.name}/*`}
                  element={<VmTopBar key={`${selectedServer.name}-${selectedVm.name}`} />}
                />
              )}
            </Routes>
          </MainContainer>
        </div>
      </div>
    </>
  );
}

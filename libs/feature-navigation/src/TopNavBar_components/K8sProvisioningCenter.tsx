import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrUbuntu } from 'react-icons/gr';
import { SiRedhatopenshift } from 'react-icons/si';
import { OmniIcon } from '../../../shared-ui/src/components/OmniIcon';
import { logger } from '../../../shared-state/src/utils/logger';
import envConfig from '../../../../runtime-config';
import AnthosIcon from '../../../../public/SVG/anthosIcon';

interface OmniPrereqs {
  Certs: boolean;
  Keycloak: boolean;
  OmniServer: boolean;
}

const K8sProvisioningCenter: React.FC = () => {
  const navigate = useNavigate();
  const [omniPrereqs, setOmniPrereqs] = useState<OmniPrereqs | null>(null);
  const [isLoadingOmniPrereqs, setIsLoadingOmniPrereqs] = useState<boolean>(false);

  const handleUbuntuClick = () => {
    navigate('/set-k8s?type=ubuntu');
  };

  const handleOpenShiftClick = () => {
    navigate('/set-k8s?type=openshift');
  };

  const handleOmniClick = async () => {
    // Make fresh API call to get latest prerequisites
    await checkOmniPrereqs();

    // Wait a moment for state to update
    setTimeout(() => {
      // Store the current prerequisites state for OmniProvisionPage
      if (omniPrereqs) {
        localStorage.setItem('omniPrerequisites', JSON.stringify(omniPrereqs));
      }

      // Set the appropriate page based on Certs status
      if (omniPrereqs?.Certs === true) {
        // If Certs are true, skip TLS upload and go directly to Create Omni Server
        localStorage.setItem('omniCurrentPage', 'setup');
        localStorage.setItem('omniSkipTLS', 'true');
      } else {
        // If Certs are false, show TLS upload first
        localStorage.setItem('omniCurrentPage', 'setup');
        localStorage.setItem('omniSkipTLS', 'false');
      }

      navigate('/omni-provision');
    }, 100);
  };

  const handleOmniVMClick = () => {
    navigate('/provision/omni-vm');
  };

  const handleK3sClick = () => {
    navigate('/set-k8s?type=k3s');
  };

  // DISABLED: Google Anthos
  /* const handleAnthosClick = () => {
    navigate("/set-k8s?type=anthos");
  }; */

  // Function to check Omni prerequisites
  const checkOmniPrereqs = async () => {
    if (isLoadingOmniPrereqs) return; // Prevent multiple concurrent calls

    setIsLoadingOmniPrereqs(true);
    try {
      const url = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/check/omni_prereqs`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setOmniPrereqs(result);
      } else {
        logger.error('Failed to check Omni prerequisites', { status: response.status });
        // Set default values if API fails
        setOmniPrereqs({ Certs: false, Keycloak: false, OmniServer: false });
      }
    } catch (error) {
      logger.error('Error checking Omni prerequisites', error);
      // Set default values if API fails
      setOmniPrereqs({ Certs: false, Keycloak: false, OmniServer: false });
    } finally {
      setIsLoadingOmniPrereqs(false);
    }
  };

  // Check prerequisites when component mounts (when no clusters are available)
  useEffect(() => {
    checkOmniPrereqs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Create New Kubernetes Cluster</h1>
          <p className="text-lg text-gray-600">
            Configure your k8s settings through the following steps
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Standard K8S Provisioning</h2>
            <p className="text-gray-600">
              Begin the step-by-step process to create your kubernetes cluster.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            {/* OpenShift Option */}
            <button
              onClick={handleOpenShiftClick}
              className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-red-100 rounded-full group-hover:bg-red-200 transition-colors">
                <SiRedhatopenshift className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">OpenShift</h3>
              <p className="text-sm text-gray-600 text-center">Single-step configuration</p>
            </button>

            {/* Ubuntu Option */}
            <button
              onClick={handleUbuntuClick}
              className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                <GrUbuntu className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ubuntu</h3>
              <p className="text-sm text-gray-600 text-center">Single-step configuration</p>
            </button>

            {/* K3S Option */}
            <button
              onClick={handleK3sClick}
              className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                <img src="/k3s.png" alt="K3s" className="w-8 h-8 object-contain" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">K3S</h3>
              <p className="text-sm text-gray-600 text-center">Single-page configuration</p>
            </button>

            {/* Anthos Option */}
            {/* <button
              onClick={handleAnthosClick}
              className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                <AnthosIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Anthos</h3>
              <p className="text-sm text-gray-600 text-center">
                Google Anthos setup
              </p>
            </button>  */}

            {/* Conditionally show Omni buttons based on prerequisites */}
            {isLoadingOmniPrereqs ? (
              <div className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg">
                <div className="w-16 h-16 mb-4 flex items-center justify-center bg-gray-100 rounded-full">
                  <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Checking prerequisites...
                </h3>
                <p className="text-sm text-gray-600 text-center">Loading Omni options</p>
              </div>
            ) : omniPrereqs ? (
              <>
                {/* Show Omni Server button if any prerequisite is false */}
                {(!omniPrereqs.Certs || !omniPrereqs.Keycloak || !omniPrereqs.OmniServer) && (
                  <button
                    onClick={handleOmniClick}
                    className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                  >
                    <div className="w-16 h-16 mb-4 flex items-center justify-center bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                      <OmniIcon size={32} className="" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">OmniServer</h3>
                    <p className="text-sm text-gray-600 text-center">
                      Setup prerequisites and server
                    </p>
                  </button>
                )}

                {/* Show Omni button only if all prerequisites are true */}
                {omniPrereqs.Certs && omniPrereqs.Keycloak && omniPrereqs.OmniServer && (
                  <button
                    onClick={handleOmniVMClick}
                    className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                  >
                    <div className="w-16 h-16 mb-4 flex items-center justify-center bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                      <OmniIcon size={32} className="" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Omni</h3>
                    <p className="text-sm text-gray-600 text-center">Create Omni cluster</p>
                  </button>
                )}
              </>
            ) : (
              /* Fallback: show Omni Server button if prerequisites check failed */
              <button
                onClick={handleOmniClick}
                className="flex flex-col items-center p-8 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="w-16 h-16 mb-4 flex items-center justify-center bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                  <OmniIcon size={32} className="" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Omni Server</h3>
                <p className="text-sm text-gray-600 text-center">Setup prerequisites and server</p>
              </button>
            )}
          </div>

          <div className="flex justify-center mt-8">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default K8sProvisioningCenter;

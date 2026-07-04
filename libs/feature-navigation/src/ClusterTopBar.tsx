import React, { useEffect, useState, useRef } from 'react';
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useParams,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  FaInfoCircle,
  FaList,
  FaTrash,
  FaDesktop,
  FaUpload,
  FaTrashAlt,
  FaEllipsisV,
  FaPlus,
  FaTimes,
  FaCheck,
  FaCloudUploadAlt,
  FaLaptop,
  FaServer,
} from 'react-icons/fa';
import { SiRedhatopenshift } from 'react-icons/si';
import { ScrollableContent, Breadcrumbs } from '@karios-monorepo/shared-ui';
import api from '../../shared-state/src/utils/interceptor';
import { toast } from 'react-toastify';
import { useAppState, ActionTypes } from '@karios-monorepo/shared-state';
import { logger } from '../../shared-state/src/utils/logger';
import { VirtualMachine, ServerNode } from './SideBar-types';
import envConfig from '../../../runtime-config';
import DataTable from '../../shared-state/src/widgets/DataTable';
import JobStatusModal from '../../feature-datacenter/src/JobStatusModal';
import Modal from '../../shared-state/src/widgets/Modal';
import AddVmToClusterForm from './components/AddVmToClusterForm';
import AddOpenShiftVmModal from './TopNavBar_components/AddOpenShiftVmModal';

// Local type definition for BreadcrumbItem
type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
};

// Interface for TLS upload files
interface UploadFile {
  file: File | null;
  name: string;
  type: 'cert' | 'key';
}

// Cluster Details Component
export function ClusterDetails() {
  const { clusterName } = useParams<{ clusterName: string }>();
  const location = useLocation();
  const [clusterData, setClusterData] = useState<any>(null);
  const [clusterVMs, setClusterVMs] = useState<any[]>([]);
  const [haproxyEntities, setHAProxyEntities] = useState<any[]>([]);
  const [provisioningJobs, setProvisioningJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [navigatingVm, setNavigatingVm] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletionStarted, setDeletionStarted] = useState<boolean>(false);

  // TLS upload modal state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([
    { file: null, name: '', type: 'cert' },
    { file: null, name: '', type: 'key' },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Job status modal state
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJobType, setCurrentJobType] = useState<string | null>(null);

  // Add VM to cluster modal state
  const [showAddVmModal, setShowAddVmModal] = useState<boolean>(false);

  // Add node selection modal state
  const [showAddNodeSelectionModal, setShowAddNodeSelectionModal] = useState<boolean>(false);

  // Add VM job tracking
  const [addVmJobId, setAddVmJobId] = useState<string | null>(null);
  const [addVmJobType, setAddVmJobType] = useState<string | null>(null);

  // Add OpenShift VM modal state
  const [showAddOpenShiftVmModal, setShowAddOpenShiftVmModal] = useState<boolean>(false);

  // OpenShift VM job tracking
  const [openshiftJobId, setOpenshiftJobId] = useState<string | null>(null);
  const [openshiftJobType, setOpenshiftJobType] = useState<string | null>(null);

  // Delete VM modal state
  const [showDeleteVmModal, setShowDeleteVmModal] = useState<boolean>(false);
  const [vmToDelete, setVmToDelete] = useState<any | null>(null);
  const [isDeletingVm, setIsDeletingVm] = useState<boolean>(false);

  // Track if sidebar expansion event has been dispatched for current job
  const sidebarEventDispatchedRef = useRef<boolean>(false);

  const navigate = useNavigate();
  const { state, dispatch, fetchVMsForServer } = useAppState();

  // Load job ID from localStorage on mount
  useEffect(() => {
    // Reset job states when cluster changes
    setCurrentJobId(null);
    setCurrentJobType(null);
    setAddVmJobId(null);
    setAddVmJobType(null);
    setOpenshiftJobId(null);
    setOpenshiftJobType(null);

    // Reset sidebar event dispatch flag when cluster changes
    sidebarEventDispatchedRef.current = false;

    if (clusterName) {
      const storageKey = `cluster-job-${clusterName}`;
      const storedJobData = localStorage.getItem(storageKey);

      if (storedJobData) {
        try {
          const jobData = JSON.parse(storedJobData);
          // Verify the job belongs to this cluster
          if (jobData.clusterName === clusterName) {
            setCurrentJobId(jobData.jobId);
            setCurrentJobType(jobData.jobType || 'cluster-creation');
            logger.info(`Loaded job ${jobData.jobId} from localStorage for cluster ${clusterName}`);
          } else {
            // Job doesn't belong to this cluster, remove it
            logger.warn(`Job in localStorage doesn't match current cluster, removing`);
            localStorage.removeItem(storageKey);
          }
        } catch (error) {
          logger.error('Error parsing stored job data:', error);
          localStorage.removeItem(storageKey);
        }
      }

      // Load add VM job from localStorage
      const addVmStorageKey = `cluster-add-vm-job-${clusterName}`;
      const storedAddVmJobData = localStorage.getItem(addVmStorageKey);

      if (storedAddVmJobData) {
        try {
          const addVmJobData = JSON.parse(storedAddVmJobData);
          // Verify the job belongs to this cluster
          if (addVmJobData.clusterName === clusterName) {
            setAddVmJobId(addVmJobData.jobId);
            setAddVmJobType(addVmJobData.jobType || 'add-vm-to-cluster');
            logger.info(
              `Loaded add VM job ${addVmJobData.jobId} from localStorage for cluster ${clusterName}`
            );
          } else {
            // Job doesn't belong to this cluster, remove it
            logger.warn(`Add VM job in localStorage doesn't match current cluster, removing`);
            localStorage.removeItem(addVmStorageKey);
          }
        } catch (error) {
          logger.error('Error parsing stored add VM job data:', error);
          localStorage.removeItem(addVmStorageKey);
        }
      }

      // Load OpenShift job from localStorage
      const openshiftStorageKey = `cluster-openshift-job-${clusterName}`;
      const storedOpenshiftJobData = localStorage.getItem(openshiftStorageKey);

      if (storedOpenshiftJobData) {
        try {
          const openshiftJobData = JSON.parse(storedOpenshiftJobData);
          // Verify the job belongs to this cluster
          if (openshiftJobData.clusterName === clusterName) {
            setOpenshiftJobId(openshiftJobData.jobId);
            setOpenshiftJobType(openshiftJobData.jobType || 'add-openshift-vm-to-cluster');
            logger.info(
              `Loaded OpenShift job ${openshiftJobData.jobId} from localStorage for cluster ${clusterName}`,
              {
                batchJobId: openshiftJobData.jobId,
                individualJobId: openshiftJobData.individualJobId,
                vmName: openshiftJobData.vmName,
                nodeType: openshiftJobData.nodeType,
                totalVms: openshiftJobData.totalVms,
              }
            );
          } else {
            // Job doesn't belong to this cluster, remove it
            logger.warn(`OpenShift job in localStorage doesn't match current cluster, removing`);
            localStorage.removeItem(openshiftStorageKey);
          }
        } catch (error) {
          logger.error('Error parsing stored OpenShift job data:', error);
          localStorage.removeItem(openshiftStorageKey);
        }
      }
    }
  }, [clusterName]);

  // Check if we received job info from navigation state
  useEffect(() => {
    const navState = location.state as any;
    if (navState?.showJobStatus && navState?.jobId) {
      const jobId = navState.jobId;
      const jobType = navState.jobType || 'cluster-creation';

      setCurrentJobId(jobId);
      setCurrentJobType(jobType);
      setIsJobModalOpen(true);

      // Reset sidebar event dispatch flag for new job from navigation
      sidebarEventDispatchedRef.current = false;

      // Store job info in localStorage for persistence
      if (clusterName) {
        const storageKey = `cluster-job-${clusterName}`;
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            jobId,
            jobType,
            clusterName,
            timestamp: Date.now(),
          })
        );
        logger.info(`Saved job ${jobId} to localStorage for cluster ${clusterName}`);
      }

      // Clear the navigation state to prevent re-opening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, clusterName]);

  // Function to fetch Omni dashboard URL using the shared state action
  const fetchOmniDashboardUrl = async () => {
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
      );

      if (!response.ok) {
        return;
      }

      const clusterInfo = await response.json();

      if (clusterInfo && clusterInfo.clusters && Array.isArray(clusterInfo.clusters)) {
        // Look for the "omni" cluster first
        const omniCluster = clusterInfo.clusters.find(
          (cluster: any) => cluster.KubernetesClusterName === 'omni'
        );

        if (omniCluster && omniCluster.vms && omniCluster.vms.length > 0) {
          // Look for "omniserver" VM first, or take the first VM
          const omniVM =
            omniCluster.vms.find((vm: any) => vm.vmName === 'omniserver') || omniCluster.vms[0];

          if (omniVM && omniVM.fqdn) {
            const url = `https://${omniVM.fqdn}`;
            dispatch({ type: 'SET_OMNI_DASHBOARD_URL', payload: url });
            return;
          }
        }

        // If no "omni" cluster found, look for any cluster with "omniserver" VM
        for (const cluster of clusterInfo.clusters) {
          if (cluster.vms && cluster.vms.length > 0) {
            const omniVM = cluster.vms.find((vm: any) => vm.vmName === 'omniserver');
            if (omniVM && omniVM.fqdn) {
              const url = `https://${omniVM.fqdn}`;
              dispatch({ type: 'SET_OMNI_DASHBOARD_URL', payload: url });
              return;
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching Omni dashboard URL:', error);
    }
  };

  // Function to get real-time VM state from datacenter data
  const getRealTimeVmState = (vmName: string, nodeIp: string): string => {
    if (!state.dataCenters || !Array.isArray(state.dataCenters)) {
      return 'Unknown';
    }

    // Find the server by IP in datacenter data
    const server = state.dataCenters.flatMap((dc) => dc.servers || []).find((s) => s.ip === nodeIp);

    if (server && server.vms) {
      const vm = server.vms.find((vm) => vm.name === vmName);
      if (vm && vm.state) {
        return vm.state;
      }
    }

    return 'Unknown';
  };

  // Function to update VM states with real-time data from datacenter
  const updateVMStatesWithRealTimeData = (vms: any[]) => {
    return vms.map((vm) => ({
      ...vm,
      state: vm.nodeIp
        ? getRealTimeVmState(vm.vmName || vm.name, vm.nodeIp)
        : vm.state || 'Unknown',
    }));
  };

  // Function to check if a cluster is a VIP cluster (cluster name contains "-vip-")
  const isVipCluster = (name: string | undefined): boolean => {
    if (!name) return false;
    return name.includes('-vip-');
  };

  useEffect(() => {
    if (clusterName) {
      // Reset deletion state when cluster changes
      setDeletionStarted(false);
      setIsDeleting(false);
      setShowDeleteModal(false);
      fetchClusterDetails();
      loadProvisioningJobs();

      // Fetch Omni dashboard URL on component mount for omni and om- clusters
      if (clusterName === 'omni' || clusterName.startsWith('om-')) {
        fetchOmniDashboardUrl();
      }
    }

    // Cleanup function
    return () => {};
  }, [clusterName]);

  // Update VM states when datacenter data changes and refetch if significant changes occur
  useEffect(() => {
    if (clusterVMs.length > 0 && state.dataCenters) {
      const updatedVMs = updateVMStatesWithRealTimeData(clusterVMs);
      // Only update if states have actually changed
      const statesChanged = updatedVMs.some((vm, index) => vm.state !== clusterVMs[index]?.state);

      if (statesChanged) {
        setClusterVMs(updatedVMs);
      }
    }

    // Also check if the number of VMs in the cluster might have chang
  }, [state.dataCenters]);

  // Listen for cluster deletion events and VM operations
  useEffect(() => {
    const handleClusterDeletion = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clusterName: deletedClusterName } = customEvent.detail || {};

      if (deletedClusterName && deletedClusterName === clusterName) {
        // Cluster was deleted, navigate to provisioning
        handleClusterNotFound();
      }
    };

    const handleVMOperation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { operation, vmName, clusterName: operationClusterName } = customEvent.detail || {};

      // Handle both old format (vm_name, cluster_name) and new format (vmName, clusterName)
      const actualClusterName = operationClusterName;

      if (operation && actualClusterName && actualClusterName === clusterName) {
        // VM operation in the current cluster, refresh details
        // If this is a delete operation, refresh with a callback to check if the deleted VM is currently displayed
        if (operation === 'delete' && vmName) {
          // Refresh cluster details which will handle updating the VM list
          // The fetchClusterDetails will be called and if the deleted VM is in the list,
          // it will be removed. If there are no VMs left, handleClusterNotFound will be called.
          setTimeout(async () => {
            await fetchClusterDetails();
          }, 500); // Small delay to ensure backend processing is complete
        } else {
          fetchClusterDetails();
        }
      }
    };

    const handleClusterDataRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clusterName: refreshClusterName } = customEvent.detail || {};

      // Refresh if the event is for this cluster or if no specific cluster is mentioned
      if (!refreshClusterName || refreshClusterName === clusterName) {
        logger.info(
          `Refreshing cluster data for ${clusterName} due to clusterDataRefreshNeeded event`
        );

        // Use a small timeout to debounce multiple rapid refresh requests
        const debounceKey = `cluster-refresh-${clusterName}`;
        const existingTimeout = (window as any)[debounceKey];

        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        (window as any)[debounceKey] = setTimeout(() => {
          fetchClusterDetails();
          delete (window as any)[debounceKey];
        }, 100); // 100ms debounce
      }
    };

    window.addEventListener('clusterDeleted', handleClusterDeletion);
    window.addEventListener('clusterVmOperation', handleVMOperation);
    window.addEventListener('clusterDataRefreshNeeded', handleClusterDataRefresh);

    return () => {
      window.removeEventListener('clusterDeleted', handleClusterDeletion);
      window.removeEventListener('clusterVmOperation', handleVMOperation);
      window.removeEventListener('clusterDataRefreshNeeded', handleClusterDataRefresh);
    };
  }, [clusterName]);

  // Function to handle when a cluster is not found (deleted or doesn't exist)
  const handleClusterNotFound = async () => {
    try {
      // Check if there are other clusters available
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const allClustersResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
      );

      if (allClustersResponse.ok) {
        const allClustersData = await allClustersResponse.json();

        // Check if there are any clusters available
        if (allClustersData && allClustersData.clusters && allClustersData.clusters.length > 0) {
          // Get the first available cluster
          const firstCluster = allClustersData.clusters[0];
          const firstClusterName = firstCluster.KubernetesClusterName;

          // Navigate to the first available cluster
          navigate(`/cluster/${firstClusterName}/details`, { replace: true });
        } else {
          // No clusters available, redirect to Kubernetes Provisioning Center
          navigate('/k8s-provisioning', { replace: true });
        }
      } else if (allClustersResponse.status === 404) {
        // Expected when no clusters exist - navigate to provisioning
        navigate('/k8s-provisioning', { replace: true });
      } else {
        navigate('/k8s-provisioning', { replace: true });
      }
    } catch (error) {
      // Handle "Cluster not found" and other errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Cluster not found') || errorMessage.includes('not found')) {
        logger.error(errorMessage);
      } else {
        logger.error(`Error in handleClusterNotFound: ${errorMessage}`);
      }
      navigate('/k8s-provisioning', { replace: true });
    }
  };

  // Function to load provisioning jobs from localStorage
  const loadProvisioningJobs = () => {
    if (clusterName) {
      const storageKey = `cluster-jobs-${clusterName}`;

      const storedJobs = localStorage.getItem(storageKey);

      if (storedJobs) {
        try {
          const jobData = JSON.parse(storedJobs);
          const jobs = jobData.jobs || [];
          setProvisioningJobs(jobs);
        } catch (error) {
          logger.error('Error parsing stored jobs:', error);
          setProvisioningJobs([]);
        }
      } else {
        setProvisioningJobs([]);
      }
    }
  };

  // Function to get job ID for a specific BMS server
  const getJobIdForServer = (serverName: string, nodeIp: string) => {
    const job = provisioningJobs.find(
      (job) => job.hostname === serverName || job.nodeIp === nodeIp
    );
    return job?.job_id || null;
  };

  // Function removed - no longer polling job statuses via API

  const fetchClusterDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First, get all VMs in the cluster by fetching cluster info to get VM names
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const clusterInfoResponse = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info?cluster_name=${clusterName}`
      );

      if (!clusterInfoResponse.ok) {
        throw new Error(
          `Failed to fetch cluster info: ${clusterInfoResponse.status} ${clusterInfoResponse.statusText}`
        );
      }

      const clusterInfo = await clusterInfoResponse.json();

      // Check if the response indicates no records found or if specific cluster doesn't exist
      if (
        clusterInfo &&
        (clusterInfo.message === `no records found for cluster "${clusterName}"` ||
          (typeof clusterInfo === 'string' && clusterInfo.includes('no records found')) ||
          clusterInfo.error === 'no records found' ||
          (clusterInfo.clusters && clusterInfo.clusters.length === 0) ||
          (clusterInfo.clusters &&
            !clusterInfo.clusters.find(
              (cluster: any) => cluster.KubernetesClusterName === clusterName
            )))
      ) {
        await handleClusterNotFound();
        return;
      }

      // Extract VMs, HAProxy entities, and BMS info from cluster info
      let vmDetails: any[] = [];
      let haproxyEntities: any[] = [];
      let bmsInfo: any[] = [];
      let zoneName = '';

      if (clusterInfo && clusterInfo.clusters && clusterInfo.clusters.length > 0) {
        // New API response format with clusters array
        const clusterData = clusterInfo.clusters.find(
          (cluster: any) => cluster.KubernetesClusterName === clusterName
        );
        if (clusterData) {
          vmDetails = clusterData.vms || [];
          haproxyEntities = clusterData.entities || []; // Extract HAProxy entities
          bmsInfo = clusterData.bmsInfo || []; // Extract BMS info
          zoneName = clusterData.zoneName || '';
        } else {
          // Cluster not found in the clusters array
          await handleClusterNotFound();
          return;
        }
      } else if (clusterInfo && clusterInfo.cluster && clusterInfo.cluster.vms) {
        vmDetails = clusterInfo.cluster.vms;
        haproxyEntities = clusterInfo.cluster.entities || [];
        bmsInfo = clusterInfo.cluster.bmsInfo || [];
        zoneName = clusterInfo.cluster.zoneName || '';
      } else if (clusterInfo && clusterInfo.vms) {
        vmDetails = clusterInfo.vms;
        haproxyEntities = clusterInfo.entities || [];
        bmsInfo = clusterInfo.bmsInfo || [];
        zoneName = clusterInfo.zoneName || '';
      } else if (Array.isArray(clusterInfo)) {
        vmDetails = clusterInfo;
        haproxyEntities = [];
        bmsInfo = [];
      }

      // Normalize VM property names to match UI expectations
      const normalizeVMData = (vms: any[]) => {
        if (!Array.isArray(vms)) {
          // If it's a single VM object, wrap it in an array
          vms = [vms];
        }
        return vms.map((vm) => {
          // For cluster info, we expect the data to be more standardized
          // Just normalize the most common variations
          const normalized = {
            ...vm,
            vmName: vm.vmName || vm.VMName || vm.name,
            vmIpAddress: vm.vmIpAddress || vm.VmIpAddress,
            vmMacAddress: vm.vmMacAddress || vm.VMmacAddress,
            fqdn: vm.fqdn || vm.FQDN,
            nodeIp: vm.nodeIp || vm.NodeIp,
            clusterName: vm.clusterName || vm.ClusterName,
            state: vm.state || vm.vmState || vm.status || vm.State || 'Unknown',
          };

          return normalized;
        });
      };

      // Normalize the VM details and HAProxy entities
      const normalizedVMs = normalizeVMData(vmDetails);
      const normalizedHAProxyEntities = normalizeVMData(haproxyEntities);

      // Update VM states with real-time data from datacenter
      const vmDetailsWithRealTimeStates = updateVMStatesWithRealTimeData(normalizedVMs);
      const haproxyEntitiesWithRealTimeStates =
        updateVMStatesWithRealTimeData(normalizedHAProxyEntities);

      // Set cluster data
      setClusterData({
        clusterName: clusterName,
        vms: vmDetailsWithRealTimeStates,
        entities: haproxyEntitiesWithRealTimeStates,
        bmsInfo: bmsInfo,
        zoneName: zoneName || vmDetailsWithRealTimeStates[0]?.ZoneName || '',
      });
      setClusterVMs(vmDetailsWithRealTimeStates);
      setHAProxyEntities(haproxyEntitiesWithRealTimeStates);
    } catch (error: any) {
      logger.error('Error fetching cluster details:', error);

      // Check if this is a 404 or cluster not found error
      if (
        error.message.includes('404') ||
        error.message.includes('not found') ||
        error.message.includes('Failed to fetch cluster info: 500')
      ) {
        await handleClusterNotFound();
        return;
      }

      setError(error.message || 'Failed to fetch cluster details');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete/destroy the cluster
  const deleteCluster = async () => {
    if (!clusterName || deletionStarted) return;

    try {
      setIsDeleting(true);
      setDeletionStarted(true);
      setShowDeleteModal(false); // Close modal immediately when deletion starts

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/clusters/${clusterName}/action/destroy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: clusterName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to destroy cluster: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Check for various success indicators in the response
      const isSuccess =
        result.status === 'success' ||
        result.success === true ||
        (typeof result.message === 'string' &&
          result.message.toLowerCase().includes('destroyed successfully')) ||
        (typeof result.status === 'string' && result.status.toLowerCase().includes('success'));

      if (isSuccess) {
        const destroyedCount = result.destroyed_count || result.deletedCount || 0;

        // Dispatch custom events to notify other components about cluster deletion
        window.dispatchEvent(
          new CustomEvent('clusterDeleted', {
            detail: { clusterName: clusterName },
          })
        );
        // Also dispatch VM data refresh to ensure sidebar updates completely
        window.dispatchEvent(new CustomEvent('vmDataRefreshNeeded'));

        // Check for remaining clusters and navigate accordingly
        try {
          // Wait a moment for the cluster to be fully deleted
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Fetch updated clusters list
          const allClustersResponse = await api.fetch(
            `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/info`
          );

          if (allClustersResponse.ok) {
            const allClustersData = await allClustersResponse.json();

            // Check if there are any clusters available (excluding the one we just deleted)
            const remainingClusters =
              allClustersData?.clusters?.filter(
                (cluster: any) => cluster.KubernetesClusterName !== clusterName
              ) || [];

            if (remainingClusters.length > 0) {
              // Navigate to the first available cluster
              const firstCluster = remainingClusters[0];
              const firstClusterName = firstCluster.KubernetesClusterName;
              navigate(`/cluster/${firstClusterName}/details`, { replace: true });
            } else {
              // No clusters remaining, redirect to Kubernetes Provisioning Center
              navigate('/k8s-provisioning', { replace: true });
            }
          } else {
            navigate('/k8s-provisioning', { replace: true });
          }
        } catch (navError) {
          // Handle "Cluster not found" and other errors gracefully
          const errorMessage = navError instanceof Error ? navError.message : String(navError);
          if (errorMessage.includes('Cluster not found') || errorMessage.includes('not found')) {
             logger.error(`not found : ${errorMessage}`);
          } else {
            logger.error(`Error during post-deletion navigation: ${errorMessage}`);
          }
          navigate('/k8s-provisioning', { replace: true });
        }
      } else {
        // Even if we don't recognize the response format, if we got here, the API call succeeded
        // So let's still try to handle it as a success case
        const message = result.message || result.error || 'Unknown response format';

        // If the message contains "destroyed successfully", treat it as success
        if (
          typeof message === 'string' &&
          message.toLowerCase().includes('destroyed successfully')
        ) {
          // Dispatch custom events to notify other components about cluster deletion
          window.dispatchEvent(
            new CustomEvent('clusterDeleted', {
              detail: { clusterName: clusterName },
            })
          );
          // Also dispatch VM data refresh to ensure sidebar updates completely
          window.dispatchEvent(new CustomEvent('vmDataRefreshNeeded'));

          // Navigate to k8s provisioning or next cluster
          navigate('/k8s-provisioning', { replace: true });
        } else {
          throw new Error(message || 'Failed to destroy cluster');
        }
      }
    } catch (error: any) {
      logger.error('Error destroying cluster:', error);

      // Check if this is actually a success case that was treated as an error
      if (error.message && error.message.toLowerCase().includes('destroyed successfully')) {
        // Dispatch custom events to notify other components about cluster deletion
        window.dispatchEvent(
          new CustomEvent('clusterDeleted', {
            detail: { clusterName: clusterName },
          })
        );
        // Also dispatch VM data refresh to ensure sidebar updates completely
        window.dispatchEvent(new CustomEvent('vmDataRefreshNeeded'));

        // Navigate to k8s provisioning
        navigate('/k8s-provisioning', { replace: true });
      } else {
        // This is a real error - show ONE toast message
        toast.error(`Failed to destroy cluster: ${error.message}`);
        // Reset deletion state on failure so button becomes clickable again
        setDeletionStarted(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // TLS upload functions
  const handleFileChange = (index: number, file: File | null) => {
    const newFiles = [...uploadFiles];
    newFiles[index].file = file;
    newFiles[index].name = file ? file.name : '';
    setUploadFiles(newFiles);
  };

  const handleUpload = async () => {
    const certFile = uploadFiles.find((f) => f.type === 'cert')?.file;
    const keyFile = uploadFiles.find((f) => f.type === 'key')?.file;

    if (!certFile || !keyFile) {
      toast.error('Please select both .crt and .key files');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('cert', certFile);
      formData.append('key', keyFile);

      const response = await fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/sidero/uploadtls`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setUploadSuccess(true);
      toast.success('TLS certificates uploaded successfully!');

      // Reset form after successful upload
      setTimeout(() => {
        setUploadFiles([
          { file: null, name: '', type: 'cert' },
          { file: null, name: '', type: 'key' },
        ]);
        setUploadSuccess(false);
        setShowUploadModal(false);
      }, 2000);
    } catch (error: any) {
      logger.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Function to handle VM submission from the form component
  const handleVmSubmit = async (vmConfig: any) => {
    // Find the server object to get FQDN with IP fallback
    const availableServers = getAvailableServers();
    const selectedServer = availableServers.find(
      (s) => s.ip === vmConfig.node_ip || s.fqdn === vmConfig.node_ip
    );
    const nodeIp = selectedServer ? selectedServer.fqdn || selectedServer.ip : vmConfig.node_ip;

    const payload = {
      cluster_name: clusterName,
      vm_type: vmConfig.vm_type,
      vm_config: {
        os_type: vmConfig.os_type,
        image_name: vmConfig.image_name,
        username: vmConfig.username,
        password: vmConfig.password,
        datastore: vmConfig.datastore,
        vm_name: vmConfig.vm_name,
        cpu: vmConfig.cpu,
        memory: vmConfig.memory,
        disk_size: vmConfig.disk_size,
        nw_switch: vmConfig.nw_switch,
        node_ip: nodeIp, // FQDN with IP fallback
        domain: vmConfig.domain,
      },
    };

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/cluster/node/add`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add VM to cluster: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Store job ID in localStorage
    if (result.job_id && clusterName) {
      const storageKey = `cluster-add-vm-job-${clusterName}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          jobId: result.job_id,
          jobType: 'add-vm-to-cluster',
          clusterName,
          vmName: result.vm_name,
          timestamp: Date.now(),
        })
      );

      // Update add VM job state
      setAddVmJobId(result.job_id);
      setAddVmJobType('add-vm-to-cluster');
    }

    // Reset sidebar event dispatch flag for new job
    sidebarEventDispatchedRef.current = false;

    // Set job ID and open job status modal
    setCurrentJobId(result.job_id);
    setCurrentJobType('Adding VM to Cluster');
    setShowAddVmModal(false);
    setIsJobModalOpen(true);

    toast.success(`Adding ${vmConfig.vm_type} node to cluster ${clusterName}`);
  };

  // Function to get available servers from datacenter data
  const getAvailableServers = () => {
    if (!state.dataCenters || !Array.isArray(state.dataCenters)) {
      return [];
    }
    return state.dataCenters
      .flatMap((dc) => dc.servers || [])
      .filter((server) => server && server.ip)
      .map((server) => ({
        name: server.name,
        ip: server.ip,
        fqdn: server.fqdn, // Include FQDN for node_ip resolution
      }));
  };

  const isUploadReady = uploadFiles.every((f) => f.file !== null);

  // Function to handle Add Node button click with control plane check
  const handleAddVmClick = () => {
    // Control plane is running or doesn't exist (edge case), proceed to show selection modal
    setShowAddNodeSelectionModal(true);
  };

  // Function to handle VM selection from the node type modal
  const handleAddVmSelection = () => {
    setShowAddNodeSelectionModal(false);
    setShowAddVmModal(true);
  };

  // Function to handle going back from VM form to selection modal
  const handleBackFromVmForm = () => {
    setShowAddVmModal(false);
    setShowAddNodeSelectionModal(true);
  };

  // Function to handle OpenShift VM submission
  const handleOpenshiftVmSubmit = async (vmConfig: any) => {
    try {
      // Find the server object to get FQDN with IP fallback
      const availableServers = getAvailableServers();
      const selectedServer = availableServers.find((s) => s.ip === vmConfig.node_ip);
      const nodeIp = selectedServer ? selectedServer.fqdn || selectedServer.ip : vmConfig.node_ip;

      // Create payload for OpenShift batch VM provisioning API
      const payload: any = {
        vm_name: vmConfig.vm_name,
        os_types: 'other',
        loader: 'uefi',
        cpu: vmConfig.cpu,
        sockets: 1,
        memory: `${vmConfig.memory}G`,
        disk0_size: `${vmConfig.disk_size}G`,
        network0_switch: vmConfig.network_switch,
        kubernetes_cluster_name: clusterName,
        kubernetes_type: 'openshift-kubernetes',
        kubernetes_worker_type: vmConfig.node_type, // 'control-plane' or 'worker'
        node_ip: nodeIp, // FQDN with IP fallback
        pool: vmConfig.pool || 'default',
        domain_name: vmConfig.domain_name || '',
        disk0_type: 'virtio-blk',
        disk0_name: 'disk0.img',
        datastore: 'default',
        graphics: 'yes',
      };

      // Add haproxy_enabled if specified
      if (vmConfig.haproxy_enabled) {
        payload.haproxy_enabled = true;
      }

      // Make batch API call for OpenShift VM creation (single VM in array)
      const batchEndpoint = `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/openshift/provision/batch`;

      const response = await api.fetch(batchEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([payload]), // Array with single VM
      });

      if (!response.ok) {
        throw new Error(`Failed to add OpenShift VM: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Handle batch job response structure
      // Response format: { batch_job_id, message, status, total_vms, vm_jobs: [{ vm_name, job_id, status }] }
      const batchJobId = result.batch_job_id;
      const individualJobId = result.vm_jobs?.[0]?.job_id; // Get the first VM's job ID

      logger.info('OpenShift batch provisioning response:', {
        batchJobId,
        individualJobId,
        totalVms: result.total_vms,
        status: result.status,
        message: result.message,
      });

      // Store batch job ID in localStorage if available
      if (batchJobId && clusterName) {
        const storageKey = `cluster-openshift-job-${clusterName}`;
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            jobId: batchJobId, // Store the batch job ID
            individualJobId: individualJobId, // Also store the individual VM job ID
            jobType: 'add-openshift-vm-to-cluster',
            clusterName,
            vmName: vmConfig.vm_name,
            nodeType: vmConfig.node_type,
            totalVms: result.total_vms || 1,
            timestamp: Date.now(),
          })
        );

        // Update OpenShift job state with batch job ID
        setOpenshiftJobId(batchJobId);
        setOpenshiftJobType('add-openshift-vm-to-cluster');
      }

      // Reset sidebar event dispatch flag for new job
      sidebarEventDispatchedRef.current = false;

      // Close modal and open job status modal
      setShowAddOpenShiftVmModal(false);
      setCurrentJobId(batchJobId || individualJobId); // Prefer batch job ID for tracking
      setCurrentJobType('Adding OpenShift VM to Cluster');
      setIsJobModalOpen(true);

      toast.success(`Adding ${vmConfig.node_type} VM to OpenShift cluster ${clusterName}`);

      // Refresh cluster details after a delay
      setTimeout(() => {
        fetchClusterDetails();
      }, 2000);
    } catch (error) {
      logger.error('Error adding OpenShift VM:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to add OpenShift VM: ${errorMessage}`);
    }
  };

  // Function to handle individual VM deletion (similar to sidebar logic)
  const handleIndividualVmDelete = async (vm: any) => {
    // Open the delete confirmation modal instead of window.confirm
    setVmToDelete(vm);
    setShowDeleteVmModal(true);
  };

  // Function to confirm and execute VM deletion
  const confirmDeleteVm = async () => {
    if (!vmToDelete) return;

    try {
      setIsDeletingVm(true);

      // Use the new DELETE API endpoint
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/vm/${vmToDelete.vmName}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete VM: ${response.status} ${response.statusText}`);
      }


      // Close modal
      setShowDeleteVmModal(false);
      setVmToDelete(null);

      toast.success(`VM ${vmToDelete.vmName} deleted successfully`);

      // Check if this was the last VM in the cluster
      const remainingVMs = clusterVMs.filter((v) => v.vmName !== vmToDelete.vmName);

      if (remainingVMs.length === 0) {
        // This was the last VM, check for other clusters and navigate accordingly

        // Dispatch cluster deletion event since cluster is now empty
        window.dispatchEvent(
          new CustomEvent('clusterDeleted', {
            detail: {
              clusterName: clusterName,
              vmName: vmToDelete.vmName,
            },
          })
        );

        // Use the same logic as cluster deletion to find next available cluster
        await handleClusterNotFound();
      } else {
        // Still have VMs remaining, refresh cluster details and stay on page

        // Dispatch cluster VM operation event for sidebar update
        window.dispatchEvent(
          new CustomEvent('clusterVmOperation', {
            detail: {
              vmName: vmToDelete.vmName,
              operation: 'delete',
              clusterName: clusterName,
            },
          })
        );

        // Refresh cluster details
        fetchClusterDetails();
      }
    } catch (error) {
      logger.error('Error deleting individual VM:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to delete VM: ${errorMessage}`);
    } finally {
      setIsDeletingVm(false);
    }
  };

  // Function to handle delete button click with fresh VM state check
  const handleDeleteClick = async () => {
    // First, refresh the cluster details to ensure we have the latest VM states
    if (clusterName) {
      await fetchClusterDetails();
    }
    setShowDeleteModal(true);
  };

  // Function to handle VM click - similar to SideBar handleVmClick but adapted for cluster VMs
  const handleClusterVmClick = async (clusterVm: any) => {
    // Don't navigate for VIP VMs
    if (clusterVm['vmName']?.includes('-vip') || clusterVm['vmName']?.includes('virtual-ip')) {
      return;
    }

    // Set loading state for this specific VM
    setNavigatingVm(clusterVm.vmName);

    try {
      // Find the server that hosts this VM, checking fqdn first, then falling back to ip
      let targetServer = state.dataCenters
        .flatMap((dc) => dc.servers)
        .find((server) => server.fqdn === clusterVm.nodeIp);

      // If no match by fqdn, fallback to matching by ip
      if (!targetServer) {
        targetServer = state.dataCenters
          .flatMap((dc) => dc.servers)
          .find((server) => server.ip === clusterVm.nodeIp);
      }

      if (!targetServer) {
        logger.error('Server not found for nodeIp:', clusterVm.nodeIp);
        toast.error(
          `Server with IP ${clusterVm.nodeIp} not found. Please ensure the server is properly configured.`
        );
        setNavigatingVm(null);
        return;
      }

      // Ensure VMs are fetched for the server (this will establish WebSocket connection if needed)
      if (!targetServer.vms || targetServer.vms.length === 0) {
        await fetchVMsForServer(targetServer);

        // Wait a bit for the data to be updated in the state
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Refetch the server after potential updates, checking fqdn first, then falling back to ip
      let updatedServer = state.dataCenters
        .flatMap((dc) => dc.servers)
        .find((server) => server.fqdn === clusterVm.nodeIp);

      // If no match by fqdn, fallback to matching by ip
      if (!updatedServer) {
        updatedServer = state.dataCenters
          .flatMap((dc) => dc.servers)
          .find((server) => server.ip === clusterVm.nodeIp);
      }

      if (!updatedServer) {
        setNavigatingVm(null);
        return;
      }

      // Find the actual VM object in the server's VM list
      const targetVm = updatedServer.vms?.find((vm) => vm.name === clusterVm.vmName);

      if (!targetVm) {
        logger.error(`VM not found in server VM list after fetch: ${clusterVm.vmName}`, {
          availableVMs: updatedServer.vms?.map((vm) => vm.name),
        });

        // If still not found, try to create a basic VM object as fallback
        const virtualVm: VirtualMachine = {
          id: clusterVm.vmName,
          name: clusterVm.vmName,
          state: 'Running', // Default state
          status: 'Running',
          isOn: true,
          ip: clusterVm.vmIpAddress || 'N/A',
          os: 'Linux',
          datastore: 'N/A',
        };

        // Dispatch VM and server selection actions with the created VM object
        dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: virtualVm });
        dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: updatedServer });

        // Get distribution info from location state if available
        const distributionName = (location.state as any)?.distributionName;
        const distributionSlug = (location.state as any)?.distributionSlug;

        // Navigate to VM page with breadcrumb context
        navigate(`/server/${updatedServer.name}/vm/${clusterVm.vmName}/hardware`, {
          state: {
            distributionName,
            distributionSlug,
            clusterName,
            fromCluster: true,
          },
        });

        toast.warning(
          `VM ${clusterVm.vmName} found in cluster but not in server VM list. Some details may be limited.`
        );
        return;
      }

      // Dispatch VM and server selection actions
      dispatch({ type: ActionTypes.SET_SELECTED_VM, payload: targetVm });
      dispatch({ type: ActionTypes.SET_SELECTED_SERVER, payload: updatedServer });

      // Get distribution info from location state if available
      const distributionName = (location.state as any)?.distributionName;
      const distributionSlug = (location.state as any)?.distributionSlug;

      // Navigate to VM page with breadcrumb context
      navigate(`/server/${updatedServer.name}/vm/${targetVm.name}/hardware`, {
        state: {
          distributionName,
          distributionSlug,
          clusterName,
          fromCluster: true,
        },
      });
    } catch (error) {
      logger.error('Error handling cluster VM click:', error);
      toast.error(`Failed to navigate to ${clusterVm.vmName}. Please try again.`);
    } finally {
      setNavigatingVm(null);
    }
  };

  // Handler for job ID click to open job status modal
  const handleJobIdClick = (jobId: string, serverName: string) => {
    if (jobId && jobId !== 'No job') {
      setCurrentJobId(jobId);
      setCurrentJobType('Bare Metal Provisioning'); // Default job type for bare metal
      setIsJobModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading cluster details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 text-lg mb-2">Error loading cluster details</div>
        <div className="text-gray-600 mb-4">{error}</div>
        <button
          onClick={fetchClusterDetails}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!clusterData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">No cluster data available</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cluster Overview Cards */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Cluster Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Name:</span>
              <span className="mt-1 font-medium">{clusterData.clusterName}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Zone:</span>
              <span className="mt-1 font-medium">{clusterData.zoneName || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">Total VMs:</span>
              <span className="mt-1 font-medium">{clusterVMs.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">BMS Servers:</span>
              <span className="mt-1 font-medium">{clusterData.bmsInfo?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* VMs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            Virtual Machines ({clusterVMs.length})
          </h2>
          <div className="flex items-center gap-3">
            {/* Show View Job Status button if there's any active job (cluster creation, add VM, bare metal, or OpenShift) */}
            {(currentJobId || addVmJobId || openshiftJobId) && (
              <button
                onClick={() => {
                  // Prioritize jobs in order: OpenShift (most recent) -> bare metal -> add VM -> cluster creation
                  if (openshiftJobId) {
                    setCurrentJobId(openshiftJobId);
                    setCurrentJobType(openshiftJobType || 'Adding OpenShift VM to Cluster');
                  } else if (addVmJobId) {
                    setCurrentJobId(addVmJobId);
                    setCurrentJobType(addVmJobType || 'Adding VM to Cluster');
                  }
                  // Otherwise use the cluster creation job (currentJobId is already set)
                  setIsJobModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-karios-blue text-white rounded-lg hover:bg-purple-600 transition-colors duration-200"
                title={
                  openshiftJobId
                    ? 'View OpenShift VM job status'
                      : addVmJobId
                        ? 'View add VM job status'
                        : 'View cluster creation job status'
                }
              >
                <FaInfoCircle size={16} />
                <span>View Job Status</span>
              </button>
            )}

            {/* Add Node to Cluster button - only for k8s and k3s clusters */}
            {clusterName && (clusterName.startsWith('ub-') || clusterName.startsWith('k3s-')) && (
              <button
                onClick={handleAddVmClick}
                disabled={isVipCluster(clusterName)}
                className="flex items-center gap-2 px-4 py-2 bg-karios-blue text-white rounded-lg hover:brightness-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title={
                  isVipCluster(clusterName)
                    ? 'VIP clusters cannot be provisioned from this interface'
                    : 'Add node to cluster'
                }
              >
                <FaPlus size={16} />
                <span>Add Node to Cluster</span>
              </button>
            )}

            {/* Add VM to OpenShift Cluster button - only for OpenShift clusters */}
            {clusterName && clusterName.startsWith('op-') && (
              <button
                onClick={() => setShowAddOpenShiftVmModal(true)}
                disabled={isVipCluster(clusterName)}
                className="flex items-center gap-2 px-4 py-2 bg-karios-blue text-white rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                title={
                  isVipCluster(clusterName)
                    ? 'VIP clusters cannot be provisioned from this interface'
                    : 'Add VM to OpenShift cluster'
                }
              >
                <FaPlus size={16} />
                <span>Add VM to Cluster</span>
              </button>
            )}

            {/* Show Omni Dashboard for omni and om- clusters only */}
            {clusterName && (clusterName === 'omni' || clusterName.startsWith('om-')) && (
              <button
                onClick={() => {
                  const dashboardUrl = state['omniDashboardUrl'] || 'https://omni.karios.com';
                  window.open(dashboardUrl, '_blank');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
                title={
                  state['omniDashboardUrl']
                    ? `Open ${state['omniDashboardUrl']}`
                    : 'Open Omni Dashboard'
                }
              >
                <FaDesktop size={16} />
                <span>Omni Dashboard</span>
              </button>
            )}

            {/* Show Upload Certs only for Omni clusters (starting with 'omni') but exclude the 'omni' cluster */}
            {clusterName && clusterName.startsWith('omni') && clusterName !== 'omni' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
              >
                <FaUpload size={16} />
                <span>Upload Certs</span>
              </button>
            )}
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting || deletionStarted || isVipCluster(clusterName)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              title={
                isVipCluster(clusterName)
                  ? 'VIP clusters cannot be destroyed from this interface'
                  : isDeleting || deletionStarted
                    ? 'Destroying...'
                    : 'Destroy cluster'
              }
            >
              <FaTrashAlt size={16} />
              <span>
                {isDeleting || deletionStarted
                  ? 'Destroying...'
                  : clusterName === 'omni'
                    ? 'Destroy Server'
                    : 'Destroy Cluster'}
              </span>
            </button>
          </div>
        </div>

        {clusterVMs.length > 0 ? (
          <DataTable
            data={clusterVMs}
            className="m-3"
            columns={[
              {
                key: 'vmName',
                header: 'VM Name',
                render: (value, vm) => {
                  const isVip = value?.includes('-vip') || value?.includes('virtual-ip');
                  return (
                    <div
                      className={`flex items-center gap-2 ${isVip ? 'opacity-50' : ''}`}
                      title={isVip ? 'VIP VMs are read-only' : undefined}
                    >
                      {navigatingVm === vm['vmName'] && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      <span
                        className={`font-medium ${
                          isVip
                            ? 'text-gray-400 hover:text-gray-500 cursor-not-allowed'
                            : 'text-blue-600 hover:text-blue-800 cursor-pointer'
                        }`}
                      >
                        {value || `VM ${clusterVMs.indexOf(vm) + 1}`}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: 'vmIpAddress',
                header: 'IP Address',
                render: (value) => (
                  <div>
                    <div>{value || 'N/A'}</div>
                  </div>
                ),
              },
              {
                key: 'vmMacAddress',
                header: 'MAC Address',
                render: (value) => (
                  <div>
                    <div className="font-mono">{value || 'N/A'}</div>
                  </div>
                ),
              },
              {
                key: 'fqdn',
                header: 'FQDN',
                render: (value) => value || 'N/A',
              },
              {
                key: 'nodeIp',
                header: 'Node IP',
                render: (value) => value || 'N/A',
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (_, vm) => {
                  const isVip =
                    vm['vmName']?.includes('-vip') || vm['vmName']?.includes('virtual-ip');
                  return (
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isVip) {
                            handleIndividualVmDelete(vm);
                          }
                        }}
                        disabled={isVip}
                        className={`p-2 rounded-md transition-colors ${
                          isVip
                            ? 'text-gray-600 cursor-not-allowed opacity-50'
                            : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                        }`}
                        title={isVip ? 'VIP VMs cannot be deleted' : 'Delete VM'}
                      >
                        <FaTrashAlt size={18} />
                      </button>
                    </div>
                  );
                },
              },
            ]}
            hoverable={true}
            maxHeight="600px"
            onRowClick={(vm) =>
              !(vm['vmName']?.includes('-vip') || vm['vmName']?.includes('virtual-ip')) &&
              handleClusterVmClick(vm)
            }
          />
        ) : (
          <div className="text-center text-gray-500 py-8">No VMs found in this cluster</div>
        )}
      </div>

      {/* HAProxy Entities Table */}
      {haproxyEntities && haproxyEntities.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">HAProxy Load Balancers</h2>
            <p className="text-sm text-gray-600 mt-1">
              High availability load balancers for this cluster
            </p>
          </div>

          <DataTable
            data={haproxyEntities}
            columns={[
              {
                key: 'vmName',
                header: 'HAProxy Name',
                render: (value) => (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium">{value || 'N/A'}</span>
                  </div>
                ),
              },
              {
                key: 'vmIpAddress',
                header: 'IP Address',
                render: (value) => value || 'N/A',
              },
              {
                key: 'vmMacAddress',
                header: 'MAC Address',
                render: (value) => <span className="font-mono text-sm">{value || 'N/A'}</span>,
              },
              {
                key: 'fqdn',
                header: 'FQDN',
                render: (value) => <div className="font-mono text-sm">{value || 'N/A'}</div>,
              },
              {
                key: 'nodeIp',
                header: 'Node IP',
                render: (value) => value || 'N/A',
              },
            ]}
            hoverable={true}
            maxHeight="400px"
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">HAProxy Load Balancers (0)</h2>
            <p className="text-sm text-gray-600 mt-1">
              No HAProxy load balancers configured for this cluster
            </p>
          </div>

          <div className="text-center text-gray-500 py-8">
            <div className="text-sm">
              HAProxy load balancers will appear here once configured.
              {haproxyEntities && haproxyEntities.length === 0 && (
                <div className="text-xs text-gray-400 mt-2"></div>
              )}
              {!haproxyEntities && <div className="text-xs text-gray-400 mt-2">N/A</div>}
            </div>
          </div>
        </div>
      )}

      {/* BMS Info Table */}
      {clusterData.bmsInfo && clusterData.bmsInfo.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              Bare Metal ({clusterData.bmsInfo.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Physical servers associated with this cluster
            </p>
          </div>

          <DataTable
            data={clusterData.bmsInfo}
            columns={[
              {
                key: 'name',
                header: 'Server Name',
                render: (value) => <span className="font-medium">{value || 'N/A'}</span>,
              },
              {
                key: 'ipAddress',
                header: 'IP Address',
                render: (value) => <span className="font-mono text-sm">{value || 'N/A'}</span>,
              },
              {
                key: 'nodeIp',
                header: 'Node IP',
                render: (value) => <span className="font-mono text-sm">{value || 'N/A'}</span>,
              },
              {
                key: 'job_id',
                header: 'Job ID',
                render: (value, row) => {
                  const jobId = getJobIdForServer(row.name, row.nodeIp);
                  return jobId ? (
                    <span
                      className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                      onClick={() => handleJobIdClick(jobId, row.name)}
                      title="Click to view job status"
                    >
                      {jobId}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">No job</span>
                  );
                },
              },
            ]}
            hoverable={true}
            maxHeight="400px"
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Bare Metal (0)</h2>
            <p className="text-sm text-gray-600 mt-1">No bare metal configured for this cluster</p>
          </div>

          <div className="text-center text-gray-500 py-8">
            <div className="text-sm">Bare metal will appear here once configured.</div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal &&
        !deletionStarted &&
        (() => {
          return (
            <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center p-4">
              <div
                className="bg-white rounded-lg shadow-sm w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                {/* Modal header */}
                <div className="flex justify-between items-center bg-[#E8EAF0] p-4 pl-7 rounded-t-lg">
                  <h3 className="text-lg font-medium">
                    {clusterName === 'omni' ? 'Destroy Server' : 'Destroy Cluster'}
                  </h3>
                </div>

                {/* Modal body */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-full">
                      <FaTrashAlt size={24} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-gray-700">
                        Are you sure you want to destroy{' '}
                        {clusterName === 'omni' ? 'server' : 'cluster'}{' '}
                        <strong>`&quot;`{clusterName}`&quot;`</strong>?
                      </p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      <strong>Note:</strong> This will delete all the resources related to the{' '}
                      {clusterName === 'omni' ? 'server' : 'cluster'} including {clusterVMs.length}{' '}
                      virtual machine(s). This action cannot be undone.
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      disabled={isDeleting}
                      className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteCluster}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      {isDeleting && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      <span>
                        {isDeleting
                          ? 'Destroying...'
                          : clusterName === 'omni'
                            ? 'Destroy Server'
                            : 'Destroy Cluster'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* TLS Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-lg shadow-sm w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal header */}
            <div className="flex justify-between items-center bg-[#E8EAF0] p-3 pl-5 rounded-t-lg">
              <h3 className="text-base font-medium">Upload TLS Certificates</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FaTimes className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4">
              <div className="text-center mb-4">
                <p className="text-xs text-gray-600">
                  Upload TLS certificate and key files for cluster <strong>`&quot;`{clusterName}`&quot;`</strong>
                </p>
              </div>

              {uploadSuccess ? (
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FaCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-green-900 mb-1">Upload Successful!</h3>
                  <p className="text-xs text-green-700">TLS certificates uploaded successfully.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* File Upload Areas */}
                  <div className="grid grid-cols-2 gap-3">
                    {uploadFiles.map((uploadFile, index) => (
                      <div
                        key={index}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-gray-400 transition-colors"
                      >
                        <input
                          type="file"
                          id={`file-${index}`}
                          accept={uploadFile.type === 'cert' ? '.crt' : '.key'}
                          onChange={(e) => handleFileChange(index, e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label htmlFor={`file-${index}`} className="cursor-pointer">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <FaCloudUploadAlt className="w-4 h-4 text-gray-600" />
                          </div>
                          <h3 className="text-xs font-medium text-gray-900 mb-1">
                            {uploadFile.type === 'cert' ? 'Certificate (.crt)' : 'Key (.key)'}
                          </h3>
                          {uploadFile.file ? (
                            <p
                              className="text-xs text-green-600 font-medium truncate"
                              title={uploadFile.name}
                            >
                              {uploadFile.name}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-600">Select file</p>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="w-5 h-5 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-1"></div>
                      <p className="text-xs text-blue-700">Uploading certificates...</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end pt-3">
                    <button
                      onClick={() => setShowUploadModal(false)}
                      disabled={isUploading}
                      className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={!isUploadReady || isUploading}
                      className={`px-4 py-1.5 text-sm rounded-md transition-colors duration-200 flex items-center gap-1.5 ${
                        isUploadReady && !isUploading
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isUploading && (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Node Selection Modal */}
      {showAddNodeSelectionModal && (
        <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-lg shadow-sm w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal header */}
            <div className="flex justify-between items-center bg-[#E8EAF0] p-4 pl-7 rounded-t-lg">
              <h3 className="text-lg font-medium">Add Node to Cluster</h3>
              <button
                onClick={() => setShowAddNodeSelectionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FaTimes className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Choose the type of node you want to add to cluster <strong>`&quot;`{clusterName}`&quot;`</strong>:
              </p>

              <div className="space-y-4">
                {/* Virtual Machine Option */}
                <button
                  onClick={handleAddVmSelection}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FaLaptop className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Virtual Machine</h4>
                      <p className="text-sm text-gray-600">
                        Add a virtual machine node to the cluster
                      </p>
                    </div>
                  </div>
                </button>

              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowAddNodeSelectionModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add VM to Cluster Form Component */}
      {showAddVmModal && clusterName && (
        <Modal
          isOpen={showAddVmModal}
          onClose={() => setShowAddVmModal(false)}
          title="Add VM to Cluster"
          width="700px"
          scrollable={true}
        >
          <AddVmToClusterForm
            clusterName={clusterName}
            clusterType={
              clusterName.startsWith('k3s-')
                ? 'k3s'
                : clusterName.startsWith('k8s-')
                  ? 'k8s'
                  : clusterName.startsWith('ub-')
                    ? 'ubuntu'
                    : clusterName.startsWith('op-')
                      ? 'openshift'
                      : 'other'
            }
            availableServers={getAvailableServers()}
            existingVMs={clusterVMs}
            onSubmit={handleVmSubmit}
            onCancel={() => setShowAddVmModal(false)}
            onBack={handleBackFromVmForm}
          />
        </Modal>
      )}


      {/* Add OpenShift VM to Cluster Form Modal */}
      {showAddOpenShiftVmModal && clusterName && (
        <AddOpenShiftVmModal
          isOpen={showAddOpenShiftVmModal}
          onClose={() => setShowAddOpenShiftVmModal(false)}
          clusterName={clusterName}
          clusterData={clusterData}
          onSubmit={handleOpenshiftVmSubmit}
          availableServers={getAvailableServers()}
        />
      )}

      {/* Delete VM Confirmation Modal */}
      {showDeleteVmModal && vmToDelete && (
        <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-lg shadow-sm w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal header */}
            <div className="flex justify-between items-center bg-[#E8EAF0] p-4 pl-7 rounded-t-lg">
              <h3 className="text-lg font-medium">Delete Virtual Machine</h3>
            </div>

            {/* Modal body */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <FaTrashAlt size={24} className="text-red-600" />
                </div>
                <div>
                  <p className="text-gray-700">
                    Are you sure you want to delete VM <strong>`&quot;`{vmToDelete.vmName}`&quot;`</strong>?
                  </p>
                </div>
              </div>

              {/* Warning for control plane VMs */}
              {vmToDelete.vmName?.includes('controlplane') && (
                <div className="mb-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <svg
                          className="w-5 h-5 text-amber-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-amber-800 mb-1">
                          Control Plane Warning
                        </h4>
                        <p className="text-sm text-amber-700">
                          Deleting a control plane node may impact cluster stability. For high
                          availability, maintain an odd number of control plane nodes (1, 3, 5,
                          etc.).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                  <strong>Warning:</strong> This action cannot be undone. The VM and all its data
                  will be permanently deleted.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteVmModal(false);
                    setVmToDelete(null);
                  }}
                  disabled={isDeletingVm}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteVm}
                  disabled={isDeletingVm}
                  className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  {isDeletingVm && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>{isDeletingVm ? 'Deleting...' : 'Delete VM'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Status Modal */}
      <JobStatusModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        jobId={currentJobId}
        jobType={currentJobType}
        title={`Creating Cluster: ${clusterName}`}
        onJobComplete={(jobId) => {
          logger.info(`Job ${jobId} completed successfully`);

          // Check what type of job this is and clear the appropriate state
          if (jobId === addVmJobId) {
            // Clear add VM job ID from state and localStorage
            setAddVmJobId(null);
            setAddVmJobType(null);
            if (clusterName) {
              const addVmStorageKey = `cluster-add-vm-job-${clusterName}`;
              localStorage.removeItem(addVmStorageKey);
            }
          } else if (jobId === openshiftJobId) {
            // Clear OpenShift job ID from state and localStorage
            setOpenshiftJobId(null);
            setOpenshiftJobType(null);
            if (clusterName) {
              const openshiftStorageKey = `cluster-openshift-job-${clusterName}`;
              localStorage.removeItem(openshiftStorageKey);
              logger.info(
                `Removed OpenShift job ${jobId} from localStorage for cluster ${clusterName}`
              );
            }
          } else {
            // Clear cluster creation job ID from state and localStorage
            setCurrentJobId(null);
            setCurrentJobType(null);
            if (clusterName) {
              const storageKey = `cluster-job-${clusterName}`;
              localStorage.removeItem(storageKey);
              logger.info(`Removed job ${jobId} from localStorage for cluster ${clusterName}`);
            }
          }

          // Dispatch expandClusterInSidebar event to trigger sidebar refresh
          // This ensures the cluster dropdown expands and VMs are refreshed
          // Only dispatch once per job completion
          if (clusterName && !sidebarEventDispatchedRef.current) {
            window.dispatchEvent(
              new CustomEvent('expandClusterInSidebar', {
                detail: { clusterName },
              })
            );
            sidebarEventDispatchedRef.current = true;
            logger.info(`Dispatched expandClusterInSidebar event for cluster ${clusterName}`);

            // Refresh cluster details to update tables in this component
            fetchClusterDetails();
          }

          // Close modal automatically on job completion
          setIsJobModalOpen(false);
        }}
      />
    </div>
  );
}

// Main Cluster TopBar Component
export default function ClusterTopBar() {
  const { clusterName } = useParams<{ clusterName: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're at the base cluster path
  const isClusterBasePath = location.pathname === `/cluster/${clusterName}`;

  // Get distribution info from navigation state
  const distributionName = (location.state as any)?.distributionName;
  const distributionSlug = (location.state as any)?.distributionSlug;

  if (!clusterName) {
    return (
      <div className="text-center p-6">
        <div className="text-red-500 text-lg">Invalid cluster selection</div>
      </div>
    );
  }

  // Handle navigation back to distribution or kubernetes dashboard
  const handleBackNavigation = () => {
    if (distributionSlug) {
      navigate(`/kubernetes-dashboard/${distributionSlug}`);
    } else {
      window.history.back();
    }
  };

  // Build breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = distributionName
    ? [
        {
          label: 'Distributions',
          onClick: () => navigate('/kubernetes-dashboard'),
        },
        {
          label: distributionName,
          onClick: () => navigate(`/kubernetes-dashboard/${distributionSlug}`),
        },
        {
          label: clusterName,
          isActive: true,
        },
      ]
    : [
        {
          label: 'Clusters',
        },
        {
          label: clusterName,
          isActive: true,
        },
      ];

  return (
    <>
      {/* Navigation Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 rounded-lg shadow-sm mb-0">
        <div className="flex flex-col gap-[10px] px-4 pt-2 pb-0 overflow-x-auto whitespace-nowrap">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} onBack={handleBackNavigation} />

          {/* Navigation items */}
          <div className="flex items-center bg-white rounded-lg p-0 m-0">
            <NavItem to={`/cluster/${clusterName}/details`} icon={FaInfoCircle} label="Details" />
          </div>
        </div>
      </div>

      {/* Route Content */}
      <ScrollableContent hasTopBar={true} topBarHeight="120px">
        <div className="min-h-full">
          {/* Redirect to Details by Default */}
          {isClusterBasePath && <Navigate to={`/cluster/${clusterName}/details`} replace />}

          <Routes>
            <Route path="details" element={<ClusterDetails />} />
          </Routes>
        </div>
      </ScrollableContent>
    </>
  );
}

// Define NavItem props interface
interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
}

// Reusable NavItem Component with Icons
export function NavItem({ to, icon: Icon, label }: NavItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 text-md px-[10px] pt-4 pb-0 transition-colors duration-200 ${
          isActive ? 'text-karios-green relative' : 'text-gray-700 hover:text-green-600'
        }`
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {({ isActive }) => {
        // Determine icon color based on active state and hover state
        const iconColor = isActive
          ? 'var(--karios-blue)'
          : isHovered
            ? 'var(--karios-blue)' // Karios blue on hover
            : '#000000'; // Default black

        return (
          <div className="relative">
            <div className="flex items-center mb-1">
              <Icon size={20} color={iconColor} />
              <span className="ml-1">{label}</span>
            </div>
            {isActive && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ backgroundColor: 'var(--karios-blue)' }}
              ></div>
            )}
          </div>
        );
      }}
    </NavLink>
  );
}

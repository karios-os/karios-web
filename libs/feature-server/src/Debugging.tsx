import React, { useState, useEffect, useRef } from 'react';
import { useServer, api } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import envConfig from '../../../runtime-config';

interface DebugParameter {
  name: string;
  type: string;
  label: string;
  default?: string;
  required: boolean;
  dependsOn?: string;
  dependsOnValue?: string;
}

interface DebugTool {
  name: string;
  command: string[];
  description: string;
  parameters?: DebugParameter[];
}

type DebugToolsResponse = DebugTool[];

function Debugging() {
  const logger = createComponentLogger('Debugging');

  const { selectedServer } = useServer();
  const [debugTools, setDebugTools] = useState<DebugToolsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState<boolean>(false);
  const [allResults, setAllResults] = useState<{
    [toolName: string]: { result?: any; status: 'pending' | 'running' | 'completed' };
  }>({});
  const [currentlyExecuting, setCurrentlyExecuting] = useState<string | null>(null);
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set());
  const [individualResults, setIndividualResults] = useState<{
    [toolName: string]: { result?: any; error?: string };
  }>({});
  const [toolParameters, setToolParameters] = useState<{
    [toolName: string]: { [paramName: string]: string };
  }>({});
  const [ktraceType, setKtraceType] = useState<{ [toolName: string]: 'Command' | 'PID' }>({});
  const [processList, setProcessList] = useState<any[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState<boolean>(false);
  const [showProcessList, setShowProcessList] = useState<{ [toolName: string]: boolean }>({});
  const [interfaceList, setInterfaceList] = useState<string[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState<boolean>(false);
  const [showInterfaceList, setShowInterfaceList] = useState<{ [toolName: string]: boolean }>({});
  const [configureAll, setConfigureAll] = useState<boolean>(false);
  const [allToolsParameters, setAllToolsParameters] = useState<{
    [toolName: string]: { [paramName: string]: string };
  }>({});
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [executionFilePath, setExecutionFilePath] = useState<string | null>(null);
  const [toolReports, setToolReports] = useState<{
    [toolName: string]: { path?: string; generating?: boolean; error?: string };
  }>({});
  const [viewMode, setViewMode] = useState<'individual' | 'runall'>('individual');
  const [runAllInProgress, setRunAllInProgress] = useState<boolean>(false);
  const [showConfigPanel, setShowConfigPanel] = useState<{ [toolName: string]: boolean }>({});
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showResultsModal, setShowResultsModal] = useState<boolean>(false);
  const [modalResult, setModalResult] = useState<{
    toolName: string;
    result: any;
    error?: string;
  } | null>(null);

  // Ref for the configuration section
  const configurationSectionRef = useRef<HTMLDivElement>(null);
  const requiresConfigurationRef = useRef<HTMLDivElement>(null);

  // Function to open results modal
  const openResultsModal = (toolName: string) => {
    const result = individualResults[toolName];
    if (result) {
      setModalResult({ toolName, result: result.result, error: result.error });
      setShowResultsModal(true);
    }
  };

  // Function to close results modal
  const closeResultsModal = () => {
    setShowResultsModal(false);
    setModalResult(null);
  };

  // Function to format output in a human-readable way
  const formatOutput = (data: any): string => {
    if (typeof data === 'string') {
      // Clean up string output
      return data.trim();
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return 'No items found';
      }

      // Format array items
      return data
        .map((item, index) => {
          if (typeof item === 'object' && item !== null) {
            // Format object items in array
            const formatted = Object.entries(item)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            return `${index + 1}. ${formatted}`;
          } else {
            return `${index + 1}. ${item}`;
          }
        })
        .join('\n');
    }

    if (typeof data === 'object' && data !== null) {
      // Format object properties
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return 'Empty object';
      }

      return entries
        .map(([key, value]) => {
          // Format key-value pairs nicely
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              return `${key}: [${value.length} items]`;
            } else {
              return `${key}: ${JSON.stringify(value, null, 2)}`;
            }
          } else {
            return `${key}: ${value}`;
          }
        })
        .join('\n');
    }

    // Fallback for other types
    return String(data);
  };

  useEffect(() => {
    const fetchDebugTools = async () => {
      if (!selectedServer?.fqdn && !selectedServer?.ip) return;

      try {
        setLoading(true);
        const response = await api.fetch(
          `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/tools`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: DebugToolsResponse = await response.json();
        setDebugTools(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        logger.error('Failed to fetch debug tools:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDebugTools();
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Initialize tool parameters without defaults - user must configure everything
  useEffect(() => {
    if (debugTools && Array.isArray(debugTools)) {
      const initialParams: { [toolName: string]: { [paramName: string]: string } } = {};
      const initialAllParams: { [toolName: string]: { [paramName: string]: string } } = {};
      const initialKtraceTypes: { [toolName: string]: 'Command' | 'PID' } = {};

      debugTools.forEach((tool) => {
        // Special handling for ktrace - no default values
        if (tool.name === 'ktrace') {
          initialKtraceTypes[tool.name] = 'Command';
          initialParams[tool.name] = {
            traceType: 'Command',
            command: '', // No default command
          };
          initialAllParams[tool.name] = {
            traceType: 'Command',
            command: '', // No default command
          };
        } else if (tool.parameters && tool.parameters.length > 0) {
          initialParams[tool.name] = {};
          initialAllParams[tool.name] = {};
          tool.parameters.forEach((param) => {
            initialParams[tool.name][param.name] = ''; // No default values
            initialAllParams[tool.name][param.name] = ''; // No default values
          });
        }
      });

      setToolParameters(initialParams);
      setAllToolsParameters(initialAllParams);
      setKtraceType(initialKtraceTypes);
    }
  }, [debugTools]);

  const handleToolParameterChange = (toolName: string, paramName: string, value: string) => {
    setToolParameters((prev) => ({
      ...prev,
      [toolName]: {
        ...prev[toolName],
        [paramName]: value,
      },
    }));
  };

  const handleKtraceTypeChange = (toolName: string, traceType: 'Command' | 'PID') => {
    setKtraceType((prev) => ({
      ...prev,
      [toolName]: traceType,
    }));

    // Update parameters based on trace type - no default values
    setToolParameters((prev) => ({
      ...prev,
      [toolName]: {
        traceType: traceType,
        ...(traceType === 'Command' ? { command: '' } : { pid: '' }),
      },
    }));
  };

  const fetchProcessList = async () => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) return;

    setLoadingProcesses(true);
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/processid`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const processes = await response.json();
      setProcessList(Array.isArray(processes) ? processes : []);
    } catch (err) {
      logger.error('Failed to fetch process list:', err);
      setProcessList([]);
    } finally {
      setLoadingProcesses(false);
    }
  };

  const fetchInterfaceList = async () => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) return;

    setLoadingInterfaces(true);
    try {
      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/network/interfaces`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const interfaces = await response.json();
      setInterfaceList(Array.isArray(interfaces) ? interfaces : []);
    } catch (err) {
      logger.error('Failed to fetch interface list:', err);
      setInterfaceList([]);
    } finally {
      setLoadingInterfaces(false);
    }
  };

  const toggleProcessList = (toolName: string) => {
    const isCurrentlyShowing = showProcessList[toolName];

    setShowProcessList((prev) => ({
      ...prev,
      [toolName]: !prev[toolName],
    }));

    // Fetch processes every time the dropdown is opened
    if (!isCurrentlyShowing) {
      fetchProcessList();
    }
  };

  const toggleInterfaceList = (toolName: string) => {
    const isCurrentlyShowing = showInterfaceList[toolName];

    setShowInterfaceList((prev) => ({
      ...prev,
      [toolName]: !prev[toolName],
    }));

    // Fetch interfaces every time the dropdown is opened
    if (!isCurrentlyShowing) {
      fetchInterfaceList();
    }
  };

  const selectProcess = (toolName: string, process: any) => {
    const pid = process.pid || process.id || process.processId || String(process);
    setToolParameters((prev) => ({
      ...prev,
      [toolName]: {
        ...prev[toolName],
        pid: String(pid),
      },
    }));
    setShowProcessList((prev) => ({
      ...prev,
      [toolName]: false,
    }));
  };

  const handleAllToolsParameterChange = (toolName: string, paramName: string, value: string) => {
    setAllToolsParameters((prev) => ({
      ...prev,
      [toolName]: {
        ...prev[toolName],
        [paramName]: value,
      },
    }));
  };

  const cancelConfigureAll = () => {
    setConfigureAll(false);
    setReportPath(null);
    setReportError(null);
    setExecutionFilePath(null);
    // Reset all tools parameters to empty - no defaults
    if (debugTools && Array.isArray(debugTools)) {
      const initialAllParams: { [toolName: string]: { [paramName: string]: string } } = {};
      debugTools.forEach((tool) => {
        if (tool.name === 'ktrace') {
          initialAllParams[tool.name] = {
            traceType: 'Command',
            command: '', // No default command
          };
        } else if (tool.parameters && tool.parameters.length > 0) {
          initialAllParams[tool.name] = {};
          tool.parameters.forEach((param) => {
            initialAllParams[tool.name][param.name] = ''; // No default values
          });
        }
      });
      setAllToolsParameters(initialAllParams);
    }
  };

  const runIndividualTool = async (tool: DebugTool): Promise<void> => {
    setRunningTools((prev) => new Set(prev).add(tool.name));
    // Keep tool selected during and after execution

    // Clear previous individual results for THIS tool only
    setIndividualResults((prev) => {
      const updated = { ...prev };
      delete updated[tool.name]; // Only clear results for the current tool
      return updated;
    });
    setReportPath(null);
    setReportError(null);
    // executionFilePath will be updated with the new tool's directory path

    try {
      // Build payload based on whether tool has parameters
      const payload: any = {
        toolName: tool.name,
      };

      // Special handling for ktrace
      if (tool.name === 'ktrace') {
        const traceType = ktraceType[tool.name];
        payload.parameters = {
          traceType: traceType,
        };

        if (traceType === 'Command') {
          payload.parameters.command = toolParameters[tool.name]?.command || 'ls';
        } else if (traceType === 'PID') {
          payload.parameters.pid = toolParameters[tool.name]?.pid || '1234';
        }
      } else if (tool.parameters && tool.parameters.length > 0) {
        // Add parameters if the tool has them
        payload.parameters = {};
        tool.parameters.forEach((param) => {
          const value = toolParameters[tool.name]?.[param.name] || param.default || '';
          payload.parameters[param.name] = value;
        });
      }

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/tool/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Extract filepath from response if available (check multiple possible field names)
      if (result.filePath || result.filepath || result.outputDir || result.path) {
        const extractedPath = result.filePath || result.filepath || result.outputDir || result.path;

        // If it's a file path, extract just the directory for report generation
        let directoryPath = extractedPath;
        if (extractedPath.includes('.')) {
          // This looks like a file path, extract directory
          directoryPath = extractedPath.substring(0, extractedPath.lastIndexOf('/'));
        }

        setExecutionFilePath(directoryPath);
      }

      setIndividualResults({
        [tool.name]: { result },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setIndividualResults({
        [tool.name]: { error: errorMessage },
      });
    } finally {
      setRunningTools((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tool.name);
        return newSet;
      });
    }
  };

  const validateToolParameters = (tool: DebugTool): boolean => {
    // Special handling for ktrace
    if (tool.name === 'ktrace') {
      const traceType = ktraceType[tool.name];
      if (traceType === 'Command') {
        const command = toolParameters[tool.name]?.command;
        return command && command.trim() !== '';
      } else if (traceType === 'PID') {
        const pid = toolParameters[tool.name]?.pid;
        return pid && pid.trim() !== '';
      }
      return false;
    }

    if (!tool.parameters) return true;

    return tool.parameters.every((param) => {
      if (param.required) {
        const value = toolParameters[tool.name]?.[param.name];
        return value && value.trim() !== '';
      }
      return true;
    });
  };

  // Validate all tools parameters for bulk execution
  const validateAllToolsParameters = (tool: DebugTool): boolean => {
    // Special handling for ktrace
    if (tool.name === 'ktrace') {
      const traceType = allToolsParameters[tool.name]?.traceType || 'Command';
      if (traceType === 'Command') {
        const command = allToolsParameters[tool.name]?.command;
        return command && command.trim() !== '';
      } else if (traceType === 'PID') {
        const pid = allToolsParameters[tool.name]?.pid;
        return pid && pid.trim() !== '';
      }
      return false;
    }

    if (!tool.parameters) return true;

    return tool.parameters.every((param) => {
      if (param.required) {
        const value = allToolsParameters[tool.name]?.[param.name];
        return value && value.trim() !== '';
      }
      return true;
    });
  };

  // Check if all tools are properly configured for bulk execution
  const areAllToolsConfigured = () => {
    if (!debugTools || !Array.isArray(debugTools)) return false;
    return debugTools.every((tool) => validateAllToolsParameters(tool));
  };

  // Get configuration status summary
  const getConfigurationStatus = () => {
    if (!debugTools || !Array.isArray(debugTools))
      return { configured: 0, total: 0, unconfigured: [] };

    const unconfigured: string[] = [];
    let configured = 0;

    debugTools.forEach((tool) => {
      if (validateAllToolsParameters(tool)) {
        configured++;
      } else {
        unconfigured.push(tool.name);
      }
    });

    return {
      configured,
      total: debugTools.length,
      unconfigured,
    };
  };

  const executeAllTools = async () => {
    if (!debugTools || !Array.isArray(debugTools)) return;

    setRunningAll(true);
    setAllResults({});
    setIndividualResults({}); // Clear individual results when running bulk
    setConfigureAll(false);

    try {
      // Build payload with all tool parameters
      const payload = {
        parameters: {} as { [toolName: string]: { [paramName: string]: string } },
      };

      debugTools.forEach((tool) => {
        if (tool.name === 'ktrace') {
          // Special handling for ktrace
          payload.parameters[tool.name] = {
            traceType: allToolsParameters[tool.name]?.traceType || 'Command',
            ...(allToolsParameters[tool.name]?.traceType === 'PID'
              ? { pid: allToolsParameters[tool.name]?.pid || '1234' }
              : { command: allToolsParameters[tool.name]?.command || 'ls' }),
          };
        } else if (tool.parameters && tool.parameters.length > 0) {
          // Add parameters for tools that have them
          payload.parameters[tool.name] = {};
          tool.parameters.forEach((param) => {
            payload.parameters[tool.name][param.name] =
              allToolsParameters[tool.name]?.[param.name] || param.default || '';
          });
        }
      });

      // Add timeout to detect hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 60000); // 60 second timeout

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/tools/run-all`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Handle array response from bulk execution
      let extractedFilePath = null;

      if (Array.isArray(result) && result.length > 0) {
        // Extract filepath from the first tool result (they should all be in same directory)
        const firstTool = result[0];
        if (
          firstTool &&
          (firstTool.filePath || firstTool.filepath || firstTool.outputDir || firstTool.path)
        ) {
          extractedFilePath =
            firstTool.filePath || firstTool.filepath || firstTool.outputDir || firstTool.path;
        }
      } else if (result && typeof result === 'object') {
        // Handle object response with filePath property
        if (result.filePath || result.filepath || result.outputDir || result.path) {
          extractedFilePath = result.filePath || result.filepath || result.outputDir || result.path;
        }
      }

      // Process the extracted filepath
      if (extractedFilePath) {
        // If it's a file path, extract just the directory for report generation
        let directoryPath = extractedFilePath;
        if (extractedFilePath.includes('.')) {
          // This looks like a file path, extract directory
          directoryPath = extractedFilePath.substring(0, extractedFilePath.lastIndexOf('/'));
        }

        setExecutionFilePath(directoryPath);
      }

      // Initialize results based on the response
      const initialResults: {
        [toolName: string]: { result?: any; status: 'pending' | 'running' | 'completed' };
      } = {};

      if (Array.isArray(result)) {
        // Handle array response - map by index to debugTools order
        debugTools.forEach((tool, index) => {
          if (index < result.length && result[index]) {
            initialResults[tool.name] = {
              result: result[index],
              status: 'completed',
            };
          } else {
            // Tool not found in results - still mark as completed
            initialResults[tool.name] = {
              result: 'No result returned for this tool',
              status: 'completed',
            };
          }
        });
      } else if (result && typeof result === 'object') {
        // Handle object response with tool names as keys
        debugTools.forEach((tool) => {
          if (result[tool.name]) {
            initialResults[tool.name] = {
              result: result[tool.name],
              status: 'completed',
            };
          } else {
            initialResults[tool.name] = {
              result: result,
              status: 'completed',
            };
          }
        });
      } else {
        // Fallback: mark all as completed with the same result
        debugTools.forEach((tool) => {
          initialResults[tool.name] = {
            result: result,
            status: 'completed',
          };
        });
      }

      setAllResults(initialResults);
    } catch (err) {
      logger.error('Failed to execute all tools:', err);

      let errorMessage = 'An error occurred';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Request timeout after 60 seconds - API server may be slow or unavailable';
        } else if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          errorMessage = `Network error: ${err.message} - Check if API server at 192.168.116.201:8084 is running`;
        } else if (err.message.includes('HTTP error')) {
          errorMessage = `API error: ${err.message}`;
        } else {
          errorMessage = err.message;
        }
      }

      // Mark all tools as completed even if API failed
      const errorResults: {
        [toolName: string]: { result?: any; status: 'pending' | 'running' | 'completed' };
      } = {};
      debugTools.forEach((tool) => {
        errorResults[tool.name] = { result: errorMessage, status: 'completed' };
      });
      setAllResults(errorResults);
    } finally {
      setCurrentlyExecuting(null);
      setRunningAll(false);
    }
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    setReportError(null);
    // Don't clear reportPath here - keep previous report available until new one is generated
    // setReportPath(null);

    try {
      if (!executionFilePath) {
        throw new Error(
          'No directory path available from tool execution. Please run a tool first.'
        );
      }

      // Send the directory path for report generation
      const payload = {
        outputDir: executionFilePath,
      };

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/report/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // The API should return the path to the generated report
      if (result.reportPath || result.filePath || result.filepath || result.path || result.file) {
        const newReportPath =
          result.reportPath || result.filePath || result.filepath || result.path || result.file;
        setReportPath(newReportPath);
      } else {
        // Construct path based on API pattern: use directory from filePath
        const directory = executionFilePath.includes('/')
          ? executionFilePath.substring(0, executionFilePath.lastIndexOf('/'))
          : executionFilePath;
        const reportTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0] + 'Z';
        const constructedPath = `${directory}/report-${reportTimestamp}.pdf`;
        setReportPath(constructedPath);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate report';
      setReportError(errorMessage);
      logger.error('Failed to generate report:', err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const hasExecutedTools = () => {
    return Object.keys(individualResults).length > 0 || Object.keys(allResults).length > 0;
  };

  const getReportButtonText = () => {
    if (Object.keys(allResults).length > 0) {
      return generatingReport ? 'Generating Report...' : 'Generate Report (All Tools)';
    } else if (Object.keys(individualResults).length > 0) {
      return generatingReport ? 'Generating Report...' : 'Generate Report';
    }
    return 'Generate Report';
  };

  const downloadReport = () => {
    if (!reportPath) return;

    const downloadUrl = `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/report/download?file=${encodeURIComponent(reportPath)}`;

    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = reportPath.split('/').pop() || 'debug-report.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleConfigPanel = (toolName: string) => {
    setShowConfigPanel((prev) => {
      const newState = {
        ...prev,
        [toolName]: !prev[toolName],
      };
      return newState;
    });
  };

  const generateToolReport = async (toolName: string) => {
    setToolReports((prev) => ({
      ...prev,
      [toolName]: { ...prev[toolName], generating: true, error: undefined },
    }));

    try {
      if (!executionFilePath) {
        throw new Error('No directory path available from tool execution.');
      }

      const payload = {
        outputDir: executionFilePath,
        toolName: toolName, // Optionally specify which tool to generate report for
      };

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/report/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.reportPath || result.filePath || result.filepath || result.path || result.file) {
        const reportPath =
          result.reportPath || result.filePath || result.filepath || result.path || result.file;
        setToolReports((prev) => ({
          ...prev,
          [toolName]: { path: reportPath, generating: false },
        }));
      } else {
        // Construct path based on API pattern
        const directory = executionFilePath.includes('/')
          ? executionFilePath.substring(0, executionFilePath.lastIndexOf('/'))
          : executionFilePath;
        const reportTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0] + 'Z';
        const constructedPath = `${directory}/${toolName}-report-${reportTimestamp}.pdf`;
        setToolReports((prev) => ({
          ...prev,
          [toolName]: { path: constructedPath, generating: false },
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate report';
      setToolReports((prev) => ({
        ...prev,
        [toolName]: { generating: false, error: errorMessage },
      }));
      logger.error('Failed to generate tool report:', err);
    }
  };

  const downloadToolReport = (toolName: string) => {
    const toolReport = toolReports[toolName];
    if (!toolReport?.path) return;

    const downloadUrl = `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/report/download?file=${encodeURIComponent(toolReport.path)}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = toolReport.path.split('/').pop() || `${toolName}-report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler for Execute All button - either runs all or scrolls to configuration
  const handleExecuteAllClick = () => {
    if (!areAllToolsConfigured()) {
      // Scroll to "Requires Configuration" section if tools are not configured
      setTimeout(() => {
        logger.info(
          '[DEBUG] Inside setTimeout, requiresConfigurationRef.current:',
          requiresConfigurationRef.current
        );
        if (requiresConfigurationRef.current) {
          const element = requiresConfigurationRef.current;

          // Try scrollIntoView first
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          logger.info('[DEBUG] scrollIntoView called');
        } else {
          logger.warn('[DEBUG] requiresConfigurationRef.current is null');
        }
      }, 100);
      return;
    }
    // If all tools are configured, run the sequence
    startRunAllSequence();
  };

  const startRunAllSequence = async () => {
    if (!debugTools || !Array.isArray(debugTools)) return;

    setRunAllInProgress(true);
    setAllResults({});
    setCurrentlyExecuting(null);
    setReportPath(null);
    setReportError(null);
    setExecutionFilePath(null);

    try {
      const payload = {
        parameters: allToolsParameters,
      };

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 60000); // 60 second timeout

      const response = await api.fetch(
        `${envConfig().PROTOCOL}://${selectedServer.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/debug/tools/run-all`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // The response is an array of tool results
      if (Array.isArray(result) && result.length > 0) {
        // Convert array to object format for display
        const resultsObj = {};
        result.forEach((toolResult, index) => {
          // Try to extract tool name from file path or use index
          const toolName = toolResult.filePath
            ? toolResult.filePath.split('/').pop()?.split('-')[0] || `tool_${index}`
            : `tool_${index}`;

          resultsObj[toolName] = {
            status: 'completed',
            result: toolResult.output,
            filePath: toolResult.filePath,
          };
        });
        setAllResults(resultsObj);

        // Set execution file path from first result
        if (result[0]?.filePath) {
          const basePath = result[0].filePath.split('/').slice(0, -1).join('/');
          setExecutionFilePath(basePath);
        }
      }
    } catch (err) {
      logger.error('Failed to run all tools:', err);

      let errorMessage = 'An error occurred while running all tools';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Request timeout after 60 seconds - API server may be slow or unavailable';
        } else if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          errorMessage = `Network error: ${err.message} - Check if API server at 192.168.116.201:8084 is running`;
        } else if (err.message.includes('HTTP error')) {
          errorMessage = `API error: ${err.message}`;
        } else {
          errorMessage = err.message;
        }
      }

      setReportError(errorMessage);
    } finally {
      setRunAllInProgress(false);
    }
  };

  const clearIndividualResults = () => {
    setIndividualResults({});
    setShowProcessList({});
    setProcessList([]);
    setConfigureAll(false);
    setReportPath(null);
    setReportError(null);
    setExecutionFilePath(null);
    setToolReports({});
    // Reset tool parameters to empty - no defaults
    if (debugTools && Array.isArray(debugTools)) {
      const initialParams: { [toolName: string]: { [paramName: string]: string } } = {};
      const initialAllParams: { [toolName: string]: { [paramName: string]: string } } = {};
      const initialKtraceTypes: { [toolName: string]: 'Command' | 'PID' } = {};

      debugTools.forEach((tool) => {
        // Special handling for ktrace - no default values
        if (tool.name === 'ktrace') {
          initialKtraceTypes[tool.name] = 'Command';
          initialParams[tool.name] = {
            traceType: 'Command',
            command: '', // No default command
          };
          initialAllParams[tool.name] = {
            traceType: 'Command',
            command: '', // No default command
          };
        } else if (tool.parameters && tool.parameters.length > 0) {
          initialParams[tool.name] = {};
          initialAllParams[tool.name] = {};
          tool.parameters.forEach((param) => {
            initialParams[tool.name][param.name] = ''; // No default values
            initialAllParams[tool.name][param.name] = ''; // No default values
          });
        }
      });

      setToolParameters(initialParams);
      setAllToolsParameters(initialAllParams);
      setKtraceType(initialKtraceTypes);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Main Interface */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Switcher */}
          <div className="border-b border-gray-200 px-6 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Debug Tools</h1>

              {/* View Mode Switcher */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('individual')}
                  className={`px-6 py-2 text-sm rounded-md transition-colors ${
                    viewMode === 'individual'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Individual Tools
                </button>
                <button
                  onClick={() => setViewMode('runall')}
                  className={`px-6 py-2 text-sm rounded-md transition-colors ${
                    viewMode === 'runall'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Run All Tools
                </button>
              </div>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-6">
            {/* Loading State */}
            {loading && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-gray-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-lg text-gray-600">Loading debug tools...</p>
              </div>
            )}

            {/* Notifications */}
            {(error ||
              reportError ||
              executionFilePath ||
              (!executionFilePath && hasExecutedTools())) && (
              <div className="space-y-4 mb-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
                    <svg
                      className="w-5 h-5 mr-3 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p>
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                )}

                {reportError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
                    <svg
                      className="w-5 h-5 mr-3 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p>
                      <strong>Report Generation Error:</strong> {reportError}
                    </p>
                  </div>
                )}

                {!executionFilePath && hasExecutedTools() && (
                  <div className="bg-gray-50 border border-gray-200 text-gray-800 px-4 py-3 rounded-lg flex items-center">
                    <svg
                      className="w-5 h-5 mr-3 text-gray-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm">
                      <strong>Note:</strong> Tool execution completed, but no directory path was
                      provided by the API. Report generation may not work properly.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Report Generation Section - Only for All Tools execution */}
            {Object.keys(allResults).length > 0 && viewMode === 'runall' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-r from-karios-blue/10 to-karios-blue/20 p-3 rounded-lg mr-4">
                      <svg
                        className="w-6 h-6 text-karios-blue"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Report Generation
                      </h3>
                      <p className="text-sm text-gray-600">
                        Generate a comprehensive report for your executed{' '}
                        {Object.keys(allResults).length > 0 ? 'tools' : 'tool'}
                        {Object.keys(allResults).length > 0 && (
                          <span className="ml-2 text-xs bg-karios-blue/10 text-karios-blue px-2 py-0.5 rounded-full font-medium">
                            All Tools ({Object.keys(allResults).length})
                          </span>
                        )}
                        {Object.keys(individualResults).length > 0 &&
                          Object.keys(allResults).length === 0 && (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full font-medium">
                              Individual Tool
                            </span>
                          )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={generateReport}
                      disabled={generatingReport || loading}
                      className={`px-6 py-2 text-sm rounded-lg font-medium transition-colors shadow-sm ${
                        generatingReport || loading
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-karios-blue text-white hover:bg-blue-700'
                      }`}
                    >
                      {generatingReport ? (
                        <div className="flex items-center">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Generating...
                        </div>
                      ) : (
                        getReportButtonText()
                      )}
                    </button>

                    {reportPath && (
                      <button
                        onClick={downloadReport}
                        className="px-6 py-2 text-sm bg-karios-green text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Download Report
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {reportPath && !reportError && (
              <div className="bg-gray-50 border border-gray-200 text-gray-800 px-6 py-4 rounded-lg mb-6">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <svg
                      className="w-6 h-6 text-gray-600 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="font-semibold">Report Generated Successfully!</p>
                      <p className="text-sm mt-1">
                        File: {reportPath.split('/').pop()}
                        {Object.keys(allResults).length > 0 && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full">
                            All Tools Report
                          </span>
                        )}
                        {Object.keys(individualResults).length > 0 &&
                          Object.keys(allResults).length === 0 && (
                            <span className="ml-2 text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full">
                              Individual Tool Report
                            </span>
                          )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {runningAll && currentlyExecuting && (
              <div className="bg-gray-50 border border-gray-200 text-gray-800 px-6 py-4 rounded-lg mb-6 flex items-center">
                <div className="animate-spin h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full mr-3"></div>
                <div>
                  <p className="font-semibold">Currently executing:</p>
                  <p className="text-sm">{currentlyExecuting}</p>
                </div>
              </div>
            )}

            {/* Configure All Interface */}
            {configureAll && debugTools && Array.isArray(debugTools) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Configure All Tools
                    </h2>
                    <p className="text-gray-600">
                      Set parameters for all debugging tools before execution
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelConfigureAll}
                      className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeAllTools}
                      disabled={runningAll}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors shadow-sm ${
                        runningAll
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-karios-blue text-white hover:bg-blue-700'
                      }`}
                    >
                      {runningAll ? (
                        <div className="flex items-center">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Running All Tools...
                        </div>
                      ) : (
                        'Run All Tools'
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                  {debugTools.map((tool, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow h-fit self-start"
                    >
                      <div className="flex items-center mb-3">
                        <div className="bg-gray-100 p-2 rounded-lg mr-3">
                          <svg
                            className="w-5 h-5 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                        <h3 className="font-semibold text-gray-800">{tool.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{tool.description}</p>

                      {/* Special handling for ktrace */}
                      {tool.name === 'ktrace' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Trace Type <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={allToolsParameters[tool.name]?.traceType || 'Command'}
                              onChange={(e) => {
                                const traceType = e.target.value as 'Command' | 'PID';
                                handleAllToolsParameterChange(tool.name, 'traceType', traceType);
                                if (traceType === 'Command') {
                                  handleAllToolsParameterChange(tool.name, 'command', '');
                                } else {
                                  handleAllToolsParameterChange(tool.name, 'pid', '');
                                }
                              }}
                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundPosition: 'right 8px center',
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: '16px',
                              }}
                            >
                              <option value="Command">Command</option>
                              <option value="PID">PID</option>
                            </select>
                          </div>

                          {allToolsParameters[tool.name]?.traceType === 'Command' ? (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Command to trace <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={allToolsParameters[tool.name]?.command || ''}
                                onChange={(e) =>
                                  handleAllToolsParameterChange(
                                    tool.name,
                                    'command',
                                    e.target.value
                                  )
                                }
                                placeholder="Enter command to trace"
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Process ID <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={allToolsParameters[tool.name]?.pid || ''}
                                  onChange={(e) =>
                                    handleAllToolsParameterChange(tool.name, 'pid', e.target.value)
                                  }
                                  placeholder="Enter process ID"
                                  className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleProcessList(tool.name)}
                                  disabled={loadingProcesses}
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                  title="Select from running processes"
                                >
                                  <svg
                                    className="w-3 h-3 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                              </div>

                              {/* Process List Dropdown */}
                              {showProcessList[tool.name] && (
                                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg">
                                  {loadingProcesses ? (
                                    <div className="p-2 text-xs text-gray-500 text-center">
                                      Loading processes...
                                    </div>
                                  ) : processList.length > 0 ? (
                                    processList.map((process, idx) => (
                                      <div
                                        key={idx}
                                        className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                        onClick={() => {
                                          const pid =
                                            process.pid ||
                                            process.id ||
                                            process.processId ||
                                            String(process);
                                          handleAllToolsParameterChange(
                                            tool.name,
                                            'pid',
                                            String(pid)
                                          );
                                          setShowProcessList((prev) => ({
                                            ...prev,
                                            [tool.name]: false,
                                          }));
                                        }}
                                      >
                                        <div className="text-xs font-medium text-gray-900">
                                          {process.comm || process.name || 'Unknown Process'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          PID:{' '}
                                          {process.pid ||
                                            process.id ||
                                            process.processId ||
                                            String(process)}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-2 text-xs text-gray-500 text-center">
                                      No processes found
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parameter inputs for other tools */}
                      {tool.name !== 'ktrace' && tool.parameters && tool.parameters.length > 0 && (
                        <div className="space-y-3">
                          {tool.parameters.map((param, paramIndex) => (
                            <div key={paramIndex}>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {param.label}
                                {param.required && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              <input
                                type="text"
                                value={allToolsParameters[tool.name]?.[param.name] || ''}
                                onChange={(e) =>
                                  handleAllToolsParameterChange(
                                    tool.name,
                                    param.name,
                                    e.target.value
                                  )
                                }
                                placeholder={`Enter ${param.label.toLowerCase()}`}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
                                  {param.type}
                                </span>
                                {param.default && (
                                  <span className="text-xs text-gray-500">
                                    Example: {param.default}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Show tools without parameters */}
                      {tool.name !== 'ktrace' &&
                        (!tool.parameters || tool.parameters.length === 0) && (
                          <p className="text-xs text-gray-500 italic">No parameters required</p>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Tools Content */}
            {viewMode === 'individual' &&
              debugTools &&
              Array.isArray(debugTools) &&
              !runAllInProgress && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-gray-600">
                        Configure and execute debugging tools individually
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {debugTools.length} tools available
                      </p>
                    </div>
                    {Object.keys(individualResults).length > 0 && (
                      <button
                        onClick={clearIndividualResults}
                        className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Clear Results
                      </button>
                    )}
                  </div>

                  {/* Organized Individual Tools */}
                  {(() => {
                    const configTools = debugTools.filter(
                      (tool) =>
                        tool.name === 'ktrace' || (tool.parameters && tool.parameters.length > 0)
                    );
                    const readyTools = debugTools.filter(
                      (tool) =>
                        tool.name !== 'ktrace' && (!tool.parameters || tool.parameters.length === 0)
                    );

                    return (
                      <div className="space-y-6">
                        {/* Tools that are ready to run */}
                        {readyTools.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">Ready to Run</h3>
                              <span className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded-full">
                                {readyTools.length}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                              {readyTools.map((tool, index) => (
                                <div
                                  key={`ready-${index}`}
                                  onClick={(e) => {
                                    // Only handle card selection if clicking on the card itself, not on buttons/interactive elements
                                    if (!runningTools.has(tool.name)) {
                                      // Check if the clicked element is a button or interactive element
                                      const target = e.target as HTMLElement;
                                      const isInteractiveElement =
                                        target.closest('button') ||
                                        target.closest('input') ||
                                        target.closest('select');

                                      if (!isInteractiveElement) {
                                        setSelectedTool(
                                          selectedTool === tool.name ? null : tool.name
                                        );
                                        // Close all configuration panels when selecting a different tool
                                        if (selectedTool !== tool.name) {
                                          setShowConfigPanel({});
                                        }
                                      }
                                    }
                                  }}
                                  className={`border rounded-lg p-4 transition-all hover:shadow-md h-fit self-start ${(() => {
                                    const isRunning = runningTools.has(tool.name);
                                    const hasResults = individualResults[tool.name]?.result;
                                    const isSelected = selectedTool === tool.name;

                                    if (isRunning) {
                                      return 'border-karios-green bg-karios-green/50 shadow-lg ring-2 ring-karios-green/30';
                                    } else if (hasResults) {
                                      return isSelected
                                        ? 'border-karios-green bg-karios-green/10 shadow-md ring-2 ring-karios-green/40' // Light bg when selected with results
                                        : 'border-karios-green bg-karios-green/5 shadow-md ring-1 ring-karios-green/30'; // Very light green when has results
                                    } else if (isSelected) {
                                      return 'border-karios-green bg-karios-green/10 shadow-md ring-2 ring-karios-green/40'; // Light bg when selected
                                    } else {
                                      return 'border-gray-200 bg-gray-50 hover:border-gray-300';
                                    }
                                  })()} ${
                                    !runningTools.has(tool.name)
                                      ? 'cursor-pointer hover:shadow-lg'
                                      : 'cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                                              {tool.name}
                                            </h3>
                                            {/* Running indicator */}
                                            {runningTools.has(tool.name) && (
                                              <div className="flex-shrink-0">
                                                <div className="w-5 h-5 bg-karios-green/20 rounded-full flex items-center justify-center">
                                                  <div className="w-2 h-2 bg-karios-green rounded-full animate-pulse"></div>
                                                </div>
                                              </div>
                                            )}
                                            {/* Small done indicator */}
                                            {!runningTools.has(tool.name) &&
                                              individualResults[tool.name]?.result && (
                                                <div className="flex-shrink-0">
                                                  <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <svg
                                                      className="w-3 h-3 text-gray-600"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M5 13l4 4L19 7"
                                                      />
                                                    </svg>
                                                  </div>
                                                </div>
                                              )}
                                            {/* Small error indicator */}
                                            {!runningTools.has(tool.name) &&
                                              individualResults[tool.name]?.error && (
                                                <div className="flex-shrink-0">
                                                  <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                                                    <svg
                                                      className="w-3 h-3 text-red-600"
                                                      fill="currentColor"
                                                      viewBox="0 0 20 20"
                                                    >
                                                      <path
                                                        fillRule="evenodd"
                                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                        clipRule="evenodd"
                                                      />
                                                    </svg>
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                          <p className="text-xs text-gray-500 truncate">
                                            {tool.description}
                                          </p>
                                          <code className="text-xs text-gray-400 font-mono mt-1 block truncate">
                                            {tool.command.join(' ')}
                                          </code>

                                          {/* View Results Link - shown when results exist */}
                                          {individualResults[tool.name] && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openResultsModal(tool.name);
                                              }}
                                              className="text-xs text-karios-green hover:text-green-700 hover:underline mt-2 block transition-colors"
                                            >
                                              View results
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="ml-4 flex items-center gap-2">
                                      {/* Configure button - only show if tool needs configuration */}
                                      {(tool.name === 'ktrace' ||
                                        (tool.parameters && tool.parameters.length > 0)) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleConfigPanel(tool.name);
                                            // Don't change selectedTool when toggling config panel
                                          }}
                                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                            showConfigPanel[tool.name]
                                              ? 'bg-amber-200 text-amber-800'
                                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                                          }`}
                                          title="Configure parameters"
                                        >
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                            />
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                          </svg>
                                        </button>
                                      )}

                                      {/* Play/Run Button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Always auto-select the tool when running
                                          if (selectedTool !== tool.name) {
                                            setSelectedTool(tool.name);
                                            setShowConfigPanel({});
                                          }
                                          runIndividualTool(tool);
                                        }}
                                        disabled={
                                          runningTools.has(tool.name) ||
                                          !validateToolParameters(tool) ||
                                          Boolean(individualResults[tool.name]?.error)
                                        }
                                        className={`p-2 rounded-md transition-all duration-200 ${
                                          runningTools.has(tool.name)
                                            ? 'bg-karios-green text-white cursor-not-allowed shadow-lg'
                                            : selectedTool !== tool.name
                                              ? 'bg-karios-blue text-white hover:bg-blue-700 cursor-pointer'
                                              : !validateToolParameters(tool) ||
                                                  individualResults[tool.name]?.error
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-karios-green text-white hover:bg-green-700 cursor-pointer'
                                        }`}
                                        title={
                                          runningTools.has(tool.name)
                                            ? 'Running...'
                                            : !validateToolParameters(tool)
                                              ? 'Configure parameters first'
                                              : individualResults[tool.name]?.error
                                                ? 'Failed - Configure and try again'
                                                : individualResults[tool.name]?.result
                                                  ? 'Completed - Click to re-run'
                                                  : 'Click to run - Will auto-select card'
                                        }
                                      >
                                        {runningTools.has(tool.name) ? (
                                          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                                        ) : individualResults[tool.name]?.error ? (
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                            />
                                          </svg>
                                        ) : (
                                          <svg
                                            className="w-4 h-4"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        )}
                                      </button>

                                      {/* Generate Report Button - shown when tool completed successfully */}
                                      {individualResults[tool.name]?.result && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateToolReport(tool.name);
                                            // Don't change selectedTool when generating report
                                          }}
                                          disabled={toolReports[tool.name]?.generating}
                                          className={`p-2 rounded-lg transition-colors border ${
                                            toolReports[tool.name]?.generating
                                              ? 'bg-karios-green/10 text-karios-green border-karios-green/30 cursor-not-allowed opacity-60'
                                              : 'bg-karios-green/10 text-karios-green border-karios-green/30 hover:bg-karios-green/20'
                                          }`}
                                          title="Generate PDF report"
                                        >
                                          {toolReports[tool.name]?.generating ? (
                                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                                          ) : (
                                            <svg
                                              className="w-4 h-4"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                              />
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10 12l2 2 4-4"
                                              />
                                            </svg>
                                          )}
                                        </button>
                                      )}

                                      {/* Download Report Button - shown when report is ready */}
                                      {toolReports[tool.name]?.path && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            downloadToolReport(tool.name);
                                            // Don't change selectedTool when downloading report
                                          }}
                                          className="p-2 rounded-lg bg-karios-green/10 text-karios-green border border-karios-green/30 hover:bg-karios-green/20 transition-colors"
                                          title="Download PDF report"
                                        >
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                            />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Special handling for ktrace - Horizontal Layout */}
                                  {(() => {
                                    const shouldShow =
                                      tool.name === 'ktrace' && showConfigPanel[tool.name];
                                    return shouldShow;
                                  })() && (
                                    <div
                                      className="mt-3 pt-2 border-t border-gray-100 w-full"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Type <span className="text-red-500">*</span>
                                          </label>
                                          <select
                                            value={ktraceType[tool.name] || 'Command'}
                                            onChange={(e) =>
                                              handleKtraceTypeChange(
                                                tool.name,
                                                e.target.value as 'Command' | 'PID'
                                              )
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-karios-green focus:border-karios-green bg-white appearance-none cursor-pointer"
                                            style={{
                                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                              backgroundPosition: 'right 8px center',
                                              backgroundRepeat: 'no-repeat',
                                              backgroundSize: '16px',
                                            }}
                                          >
                                            <option value="Command">Command</option>
                                            <option value="PID">PID</option>
                                          </select>
                                        </div>

                                        {ktraceType[tool.name] === 'Command' ? (
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                              Command <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                              type="text"
                                              value={toolParameters[tool.name]?.command || ''}
                                              onChange={(e) =>
                                                handleToolParameterChange(
                                                  tool.name,
                                                  'command',
                                                  e.target.value
                                                )
                                              }
                                              onClick={(e) => e.stopPropagation()}
                                              placeholder="Enter command to trace"
                                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-green"
                                            />
                                          </div>
                                        ) : (
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                              PID <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                              <input
                                                type="text"
                                                value={toolParameters[tool.name]?.pid || ''}
                                                onChange={(e) =>
                                                  handleToolParameterChange(
                                                    tool.name,
                                                    'pid',
                                                    e.target.value
                                                  )
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="Enter process ID"
                                                className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => toggleProcessList(tool.name)}
                                                disabled={loadingProcesses}
                                                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                title="Select from running processes"
                                              >
                                                <svg
                                                  className="w-3 h-3 text-gray-400"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 9l-7 7-7-7"
                                                  />
                                                </svg>
                                              </button>
                                            </div>

                                            {/* Process List Dropdown */}
                                            {showProcessList[tool.name] && (
                                              <div
                                                className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {loadingProcesses ? (
                                                  <div className="p-2 text-xs text-gray-500 text-center">
                                                    Loading processes...
                                                  </div>
                                                ) : processList.length > 0 ? (
                                                  processList.map((process, idx) => (
                                                    <div
                                                      key={idx}
                                                      onClick={() =>
                                                        selectProcess(tool.name, process)
                                                      }
                                                      className="p-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                    >
                                                      <div className="font-medium">
                                                        PID:{' '}
                                                        {process.pid ||
                                                          process.id ||
                                                          process.processId ||
                                                          process}
                                                      </div>

                                                      {(process.comm || process.name) && (
                                                        <div className="text-gray-600 truncate">
                                                          {process.comm || process.name}
                                                        </div>
                                                      )}
                                                      {process.command && (
                                                        <div className="text-gray-500 truncate">
                                                          {process.command}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ))
                                                ) : (
                                                  <div className="p-2 text-xs text-gray-500 text-center">
                                                    No processes found
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Parameter inputs for tools that have parameters (excluding ktrace) - Horizontal Layout */}
                                  {(() => {
                                    const shouldShow =
                                      tool.name !== 'ktrace' &&
                                      tool.parameters &&
                                      tool.parameters.length > 0 &&
                                      showConfigPanel[tool.name];
                                    return shouldShow;
                                  })() && (
                                    <div
                                      className="mt-3 pt-2 border-t border-gray-100 w-full"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div
                                        className={`grid gap-2 ${tool.parameters.length === 1 ? 'grid-cols-1' : tool.parameters.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}
                                      >
                                        {tool.parameters.map((param, paramIndex) => (
                                          <div key={paramIndex}>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                              {param.label.length > 12
                                                ? param.label.substring(0, 12) + '...'
                                                : param.label}
                                              {param.required && (
                                                <span className="text-red-500 ml-1">*</span>
                                              )}
                                            </label>
                                            {(() => {
                                              const shouldShowDropdown =
                                                param.name.toLowerCase().includes('pid') ||
                                                param.label.toLowerCase().includes('process') ||
                                                tool.name.includes('dtrace');
                                              return shouldShowDropdown;
                                            })() ? (
                                              <div className="relative">
                                                <input
                                                  type="text"
                                                  value={
                                                    toolParameters[tool.name]?.[param.name] || ''
                                                  }
                                                  onChange={(e) =>
                                                    handleToolParameterChange(
                                                      tool.name,
                                                      param.name,
                                                      e.target.value
                                                    )
                                                  }
                                                  onClick={(e) => e.stopPropagation()}
                                                  placeholder={`Enter ${param.label.toLowerCase()}`}
                                                  className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => toggleProcessList(tool.name)}
                                                  disabled={loadingProcesses}
                                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                  title="Select from running processes"
                                                >
                                                  <svg
                                                    className="w-3 h-3 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={2}
                                                      d="M19 9l-7 7-7-7"
                                                    />
                                                  </svg>
                                                </button>
                                              </div>
                                            ) : (
                                              <input
                                                type="text"
                                                value={
                                                  toolParameters[tool.name]?.[param.name] || ''
                                                }
                                                onChange={(e) =>
                                                  handleToolParameterChange(
                                                    tool.name,
                                                    param.name,
                                                    e.target.value
                                                  )
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder={`Enter ${param.label.toLowerCase()}`}
                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-green"
                                              />
                                            )}
                                            {param.default && (
                                              <span className="text-xs text-gray-400 mt-1 block">
                                                Example: {param.default}
                                              </span>
                                            )}

                                            {/* Process List Dropdown for PID parameters */}
                                            {(param.name.toLowerCase().includes('pid') ||
                                              param.label.toLowerCase().includes('process') ||
                                              tool.name.includes('dtrace')) &&
                                              showProcessList[tool.name] && (
                                                <div
                                                  className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {loadingProcesses ? (
                                                    <div className="p-2 text-xs text-gray-500 text-center">
                                                      Loading processes...
                                                    </div>
                                                  ) : processList.length > 0 ? (
                                                    processList.map((process, idx) => (
                                                      <div
                                                        key={idx}
                                                        onClick={() => {
                                                          const pid =
                                                            process.pid ||
                                                            process.id ||
                                                            process.processId ||
                                                            String(process);
                                                          setToolParameters((prev) => ({
                                                            ...prev,
                                                            [tool.name]: {
                                                              ...prev[tool.name],
                                                              [param.name]: String(pid),
                                                            },
                                                          }));
                                                          setShowProcessList((prev) => ({
                                                            ...prev,
                                                            [tool.name]: false,
                                                          }));
                                                        }}
                                                        className="p-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                      >
                                                        <div className="text-xs font-medium text-gray-900">
                                                          {process.comm ||
                                                            process.name ||
                                                            'Unknown Process'}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                          PID:{' '}
                                                          {process.pid ||
                                                            process.id ||
                                                            process.processId ||
                                                            String(process)}
                                                        </div>
                                                      </div>
                                                    ))
                                                  ) : (
                                                    <div className="p-2 text-xs text-gray-500 text-center">
                                                      No processes found
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Report Generation Status for individual tool */}
                                  {toolReports[tool.name]?.error && (
                                    <div className="mt-2">
                                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                        <div className="flex items-center">
                                          <svg
                                            className="w-3 h-3 text-red-500 mr-2 flex-shrink-0"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          <span className="text-xs text-red-700">
                                            Report Error: {toolReports[tool.name].error}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {toolReports[tool.name]?.path && (
                                    <div className="mt-2">
                                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                                        <div className="flex items-center">
                                          <svg
                                            className="w-3 h-3 text-gray-600 mr-2 flex-shrink-0"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          <span className="text-xs text-gray-700">
                                            Report ready:{' '}
                                            {toolReports[tool.name].path?.split('/').pop()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tools that need configuration */}
                        {configTools.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Requires Configuration
                              </h3>
                              <span className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded-full">
                                {configTools.length}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                              {configTools.map((tool, index) => (
                                <div
                                  key={index}
                                  onClick={(e) => {
                                    // Only handle card selection if clicking on the card itself, not on buttons/interactive elements
                                    if (!runningTools.has(tool.name)) {
                                      // Check if the clicked element is a button or interactive element
                                      const target = e.target as HTMLElement;
                                      const isInteractiveElement =
                                        target.closest('button') ||
                                        target.closest('input') ||
                                        target.closest('select');

                                      if (!isInteractiveElement) {
                                        setSelectedTool(
                                          selectedTool === tool.name ? null : tool.name
                                        );
                                        // Close all configuration panels when selecting a different tool
                                        if (selectedTool !== tool.name) {
                                          setShowConfigPanel({});
                                        }
                                      }
                                    }
                                  }}
                                  className={`border rounded-lg p-4 transition-all hover:shadow-md h-fit self-start ${
                                    runningTools.has(tool.name)
                                      ? 'border-karios-green bg-karios-green/50 shadow-lg ring-2 ring-karios-green/30'
                                      : individualResults[tool.name]?.result
                                        ? selectedTool === tool.name
                                          ? 'border-karios-green bg-karios-green/10 shadow-md ring-2 ring-karios-green/40' // Light bg when selected with results
                                          : 'border-karios-green bg-karios-green/5 shadow-sm ring-1 ring-karios-green/30' // Very light green when has results
                                        : selectedTool === tool.name
                                          ? 'border-karios-green bg-karios-green/10 shadow-md ring-2 ring-karios-green/40' // Light bg when selected
                                          : 'border-gray-200 bg-white hover:border-gray-300'
                                  } ${
                                    !runningTools.has(tool.name)
                                      ? 'cursor-pointer hover:shadow-lg'
                                      : 'cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-900 truncate">
                                              {tool.name}
                                            </h4>
                                            {/* Running indicator for config tools */}
                                            {runningTools.has(tool.name) ? (
                                              <div className="w-3 h-3 bg-karios-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                                                <div className="w-1.5 h-1.5 bg-karios-green rounded-full animate-pulse"></div>
                                              </div>
                                            ) : (
                                              <div className="w-3 h-3 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                <svg
                                                  className="w-2 h-2 text-white"
                                                  fill="currentColor"
                                                  viewBox="0 0 20 20"
                                                >
                                                  <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                  />
                                                </svg>
                                              </div>
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-500 truncate">
                                            {tool.description}
                                          </p>
                                          <code className="text-xs text-gray-400 font-mono mt-1 block truncate">
                                            {tool.command.join(' ')}
                                          </code>

                                          {/* View Results Link - shown when results exist */}
                                          {individualResults[tool.name] && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openResultsModal(tool.name);
                                              }}
                                              className="text-xs text-karios-green hover:text-green-700 hover:underline mt-2 block transition-colors"
                                            >
                                              View results
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="ml-4 flex items-center gap-2">
                                      {/* Configure button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleConfigPanel(tool.name);
                                          // Don't change selectedTool when toggling config panel
                                        }}
                                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                          showConfigPanel[tool.name]
                                            ? 'bg-amber-200 text-amber-800'
                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                                        }`}
                                        title="Configure parameters"
                                      >
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                          />
                                        </svg>
                                      </button>

                                      {/* Run button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Always auto-select the tool when running
                                          if (selectedTool !== tool.name) {
                                            setSelectedTool(tool.name);
                                            setShowConfigPanel({});
                                          }
                                          runIndividualTool(tool);
                                        }}
                                        disabled={
                                          runningTools.has(tool.name) ||
                                          !validateToolParameters(tool)
                                        }
                                        className={`p-2 rounded-lg transition-colors ${
                                          runningTools.has(tool.name)
                                            ? 'bg-karios-green text-white cursor-not-allowed shadow-lg'
                                            : !validateToolParameters(tool)
                                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                              : selectedTool === tool.name
                                                ? 'bg-karios-green text-white hover:bg-green-700 cursor-pointer'
                                                : 'bg-karios-blue text-white hover:bg-blue-700 cursor-pointer'
                                        }`}
                                        title={
                                          runningTools.has(tool.name)
                                            ? 'Running...'
                                            : !validateToolParameters(tool)
                                              ? 'Configure parameters first'
                                              : individualResults[tool.name]?.result
                                                ? 'Completed - Click to re-run'
                                                : 'Click to run - Will auto-select card'
                                        }
                                      >
                                        {runningTools.has(tool.name) ? (
                                          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                                        ) : (
                                          <svg
                                            className="w-4 h-4"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        )}
                                      </button>

                                      {/* Generate Report Button */}
                                      {individualResults[tool.name] && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateToolReport(tool.name);
                                            // Don't change selectedTool when generating report
                                          }}
                                          disabled={toolReports[tool.name]?.generating}
                                          className={`p-2 rounded-lg transition-colors border ${
                                            toolReports[tool.name]?.generating
                                              ? 'bg-karios-green/10 text-karios-green border-karios-green/30 cursor-not-allowed opacity-60'
                                              : 'bg-karios-green/10 text-karios-green border-karios-green/30 hover:bg-karios-green/20'
                                          }`}
                                          title="Generate PDF report"
                                        >
                                          {toolReports[tool.name]?.generating ? (
                                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                                          ) : (
                                            <svg
                                              className="w-4 h-4"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                              />
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10 12l2 2 4-4"
                                              />
                                            </svg>
                                          )}
                                        </button>
                                      )}

                                      {/* Download Report Button */}
                                      {toolReports[tool.name]?.path && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            downloadToolReport(tool.name);
                                            // Don't change selectedTool when downloading report
                                          }}
                                          className="p-2 rounded-lg bg-karios-green/10 text-karios-green border border-karios-green/30 hover:bg-karios-green/20 transition-colors"
                                          title="Download PDF report"
                                        >
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                            />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Configuration Panel for tools that need configuration */}
                                  {showConfigPanel[tool.name] && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <div className="bg-gray-50 rounded-lg p-3">
                                        <h5 className="text-xs font-medium text-gray-700 mb-2">
                                          Configuration
                                        </h5>

                                        {tool.name === 'ktrace' ? (
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Type <span className="text-red-400">*</span>
                                              </label>
                                              <select
                                                value={ktraceType[tool.name] || 'Command'}
                                                onChange={(e) => {
                                                  const traceType = e.target.value as
                                                    | 'Command'
                                                    | 'PID';
                                                  setKtraceType((prev) => ({
                                                    ...prev,
                                                    [tool.name]: traceType,
                                                  }));
                                                  if (traceType === 'Command') {
                                                    handleToolParameterChange(
                                                      tool.name,
                                                      'command',
                                                      ''
                                                    );
                                                  } else {
                                                    handleToolParameterChange(tool.name, 'pid', '');
                                                  }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue bg-white appearance-none cursor-pointer"
                                                style={{
                                                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                                  backgroundPosition: 'right 8px center',
                                                  backgroundRepeat: 'no-repeat',
                                                  backgroundSize: '16px',
                                                }}
                                              >
                                                <option value="Command">Command</option>
                                                <option value="PID">PID</option>
                                              </select>
                                            </div>

                                            {ktraceType[tool.name] === 'Command' ? (
                                              <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                  Command <span className="text-red-400">*</span>
                                                </label>
                                                <input
                                                  type="text"
                                                  value={toolParameters[tool.name]?.command || ''}
                                                  onChange={(e) =>
                                                    handleToolParameterChange(
                                                      tool.name,
                                                      'command',
                                                      e.target.value
                                                    )
                                                  }
                                                  onClick={(e) => e.stopPropagation()}
                                                  placeholder="Enter command"
                                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-blue"
                                                />
                                              </div>
                                            ) : (
                                              <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                  PID <span className="text-red-400">*</span>
                                                </label>
                                                <div className="relative">
                                                  <input
                                                    type="text"
                                                    value={toolParameters[tool.name]?.pid || ''}
                                                    onChange={(e) =>
                                                      handleToolParameterChange(
                                                        tool.name,
                                                        'pid',
                                                        e.target.value
                                                      )
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Enter process ID"
                                                    className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-blue"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleProcessList(tool.name)}
                                                    disabled={loadingProcesses}
                                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                    title="Select from running processes"
                                                  >
                                                    <svg
                                                      className="w-3 h-3 text-gray-400"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 9l-7 7-7-7"
                                                      />
                                                    </svg>
                                                  </button>
                                                </div>

                                                {/* Process List Dropdown */}
                                                {showProcessList[tool.name] && (
                                                  <div
                                                    className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    {loadingProcesses ? (
                                                      <div className="p-2 text-xs text-gray-500 text-center">
                                                        Loading processes...
                                                      </div>
                                                    ) : processList.length > 0 ? (
                                                      processList.map((process, idx) => (
                                                        <div
                                                          key={idx}
                                                          className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                          onClick={() => {
                                                            const pid =
                                                              process.pid ||
                                                              process.id ||
                                                              process.processId ||
                                                              String(process);
                                                            handleToolParameterChange(
                                                              tool.name,
                                                              'pid',
                                                              String(pid)
                                                            );
                                                            setShowProcessList((prev) => ({
                                                              ...prev,
                                                              [tool.name]: false,
                                                            }));
                                                          }}
                                                        >
                                                          <div className="text-xs font-medium text-gray-900">
                                                            {process.comm ||
                                                              process.name ||
                                                              'Unknown Process'}
                                                          </div>
                                                          <div className="text-xs text-gray-500">
                                                            PID:{' '}
                                                            {process.pid ||
                                                              process.id ||
                                                              process.processId ||
                                                              String(process)}
                                                          </div>
                                                        </div>
                                                      ))
                                                    ) : (
                                                      <div className="p-2 text-xs text-gray-500 text-center">
                                                        No processes found
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ) : tool.parameters && tool.parameters.length > 0 ? (
                                          <div
                                            className={`grid gap-2 ${tool.parameters.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                                          >
                                            {tool.parameters.map((param, paramIndex) => (
                                              <div key={paramIndex}>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                  {param.label}
                                                  {param.required && (
                                                    <span className="text-red-400 ml-1">*</span>
                                                  )}
                                                </label>
                                                {(() => {
                                                  const isInterfaceParam =
                                                    param.name
                                                      .toLowerCase()
                                                      .includes('interface') ||
                                                    param.label.toLowerCase().includes('interface');
                                                  const isPidParam =
                                                    param.name.toLowerCase().includes('pid') ||
                                                    param.label.toLowerCase().includes('process') ||
                                                    tool.name.includes('dtrace');

                                                  if (isInterfaceParam) {
                                                    // Fetch interfaces on mount if not already loaded
                                                    if (
                                                      interfaceList.length === 0 &&
                                                      !loadingInterfaces
                                                    ) {
                                                      fetchInterfaceList();
                                                    }

                                                    return (
                                                      <select
                                                        value={
                                                          toolParameters[tool.name]?.[param.name] ||
                                                          ''
                                                        }
                                                        onChange={(e) =>
                                                          handleToolParameterChange(
                                                            tool.name,
                                                            param.name,
                                                            e.target.value
                                                          )
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                        disabled={loadingInterfaces}
                                                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue bg-white appearance-none cursor-pointer"
                                                        style={{
                                                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                                          backgroundPosition: 'right 8px center',
                                                          backgroundRepeat: 'no-repeat',
                                                          backgroundSize: '16px',
                                                        }}
                                                      >
                                                        <option value="">
                                                          {loadingInterfaces
                                                            ? 'Loading interfaces...'
                                                            : 'Select interface'}
                                                        </option>
                                                        {interfaceList.map((iface, idx) => (
                                                          <option key={idx} value={iface}>
                                                            {iface}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    );
                                                  } else if (isPidParam) {
                                                    return (
                                                      <div className="relative">
                                                        <input
                                                          type="text"
                                                          value={
                                                            toolParameters[tool.name]?.[
                                                              param.name
                                                            ] || ''
                                                          }
                                                          onChange={(e) =>
                                                            handleToolParameterChange(
                                                              tool.name,
                                                              param.name,
                                                              e.target.value
                                                            )
                                                          }
                                                          onClick={(e) => e.stopPropagation()}
                                                          placeholder={`Enter ${param.label.toLowerCase()}`}
                                                          className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-blue"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            toggleProcessList(tool.name)
                                                          }
                                                          disabled={loadingProcesses}
                                                          className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                          title="Select from running processes"
                                                        >
                                                          <svg
                                                            className="w-3 h-3 text-gray-400"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                          >
                                                            <path
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                              strokeWidth={2}
                                                              d="M19 9l-7 7-7-7"
                                                            />
                                                          </svg>
                                                        </button>
                                                      </div>
                                                    );
                                                  } else {
                                                    return (
                                                      <input
                                                        type="text"
                                                        value={
                                                          toolParameters[tool.name]?.[param.name] ||
                                                          ''
                                                        }
                                                        onChange={(e) =>
                                                          handleToolParameterChange(
                                                            tool.name,
                                                            param.name,
                                                            e.target.value
                                                          )
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder={`Enter ${param.label.toLowerCase()}`}
                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-blue"
                                                      />
                                                    );
                                                  }
                                                })()}
                                                {param.default && (
                                                  <p className="text-xs text-gray-400 mt-0.5">
                                                    Example: {param.default}
                                                  </p>
                                                )}

                                                {/* Process List Dropdown for PID parameters */}
                                                {(param.name.toLowerCase().includes('pid') ||
                                                  param.label.toLowerCase().includes('process') ||
                                                  tool.name.includes('dtrace')) &&
                                                  showProcessList[tool.name] && (
                                                    <div
                                                      className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      {loadingProcesses ? (
                                                        <div className="p-2 text-xs text-gray-500 text-center">
                                                          Loading processes...
                                                        </div>
                                                      ) : processList.length > 0 ? (
                                                        processList.map((process, idx) => (
                                                          <div
                                                            key={idx}
                                                            className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onClick={() => {
                                                              const pid =
                                                                process.pid ||
                                                                process.id ||
                                                                process.processId ||
                                                                String(process);
                                                              handleToolParameterChange(
                                                                tool.name,
                                                                param.name,
                                                                String(pid)
                                                              );
                                                              setShowProcessList((prev) => ({
                                                                ...prev,
                                                                [tool.name]: false,
                                                              }));
                                                            }}
                                                          >
                                                            <div className="text-xs font-medium text-gray-900">
                                                              {process.comm ||
                                                                process.name ||
                                                                'Unknown Process'}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                              PID:{' '}
                                                              {process.pid ||
                                                                process.id ||
                                                                process.processId ||
                                                                String(process)}
                                                            </div>
                                                          </div>
                                                        ))
                                                      ) : (
                                                        <div className="p-2 text-xs text-gray-500 text-center">
                                                          No processes found
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-center py-2">
                                            <span className="text-xs text-gray-500">
                                              No configuration required
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Tool report path display for ready tools */}
                                  {toolReports[tool.name]?.path && (
                                    <div className="mt-2">
                                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                                        <div className="flex items-center">
                                          <svg
                                            className="w-3 h-3 text-gray-600 mr-2 flex-shrink-0"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          <span className="text-xs text-gray-700">
                                            Report ready:{' '}
                                            {toolReports[tool.name].path?.split('/').pop()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

            {/* Run All Tools Content */}
            {viewMode === 'runall' && debugTools && Array.isArray(debugTools) && (
              <>
                {/* Configuration Status & Execute Button */}
                <div className="mb-4 space-y-4">
                  {/* Configuration Status Display */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">Configuration Status</h3>
                          <p className="text-sm text-gray-600">
                            {(() => {
                              const status = getConfigurationStatus();
                              return `${status.configured}/${status.total} tools configured`;
                            })()}
                          </p>
                        </div>
                      </div>

                      {/* Configuration Progress Bar */}
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              areAllToolsConfigured() ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${(getConfigurationStatus().configured / getConfigurationStatus().total) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {Math.round(
                            (getConfigurationStatus().configured / getConfigurationStatus().total) *
                              100
                          )}
                          %
                        </span>
                      </div>
                    </div>

                    {/* Configuration Status and Execute Button */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        {/* Configuration Status & Progress */}
                        <div className="flex items-center gap-4 flex-wrap">
                          {!areAllToolsConfigured() ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-amber-700 font-medium">
                                Tools requiring configuration:
                              </span>
                              {getConfigurationStatus().unconfigured.map((toolName) => (
                                <span
                                  key={toolName}
                                  className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium"
                                >
                                  {toolName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-karios-green rounded-full flex items-center justify-center">
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span className="text-sm text-karios-green font-medium">
                                All tools configured!
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleExecuteAllClick}
                          disabled={runAllInProgress || loading}
                          className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm flex-shrink-0 ${
                            runAllInProgress || loading
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : !areAllToolsConfigured()
                                ? 'bg-gray-300 text-gray-500 cursor-pointer hover:bg-gray-400'
                                : 'bg-karios-green text-white hover:bg-green-700 hover:shadow-md'
                          }`}
                          title={
                            !areAllToolsConfigured()
                              ? 'Click to configure tools'
                              : runAllInProgress
                                ? 'Execution in progress...'
                                : 'Execute all tools'
                          }
                        >
                          {runAllInProgress ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                              <span className="text-sm">Running...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              <span className="text-sm">
                                {areAllToolsConfigured() ? 'Execute All' : 'Configure Tools First'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clean Tool Configuration Section */}
                <div className="space-y-6" ref={configurationSectionRef}>
                  {/* Tools that need configuration */}
                  {(() => {
                    const configTools = debugTools.filter(
                      (tool) =>
                        tool.name === 'ktrace' || (tool.parameters && tool.parameters.length > 0)
                    );
                    const readyTools = debugTools.filter(
                      (tool) =>
                        tool.name !== 'ktrace' && (!tool.parameters || tool.parameters.length === 0)
                    );

                    return (
                      <>
                        {readyTools.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <svg
                                className="w-4 h-4 text-karios-green"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <h4 className="text-sm font-medium text-gray-700">Ready to Run</h4>
                              <span className="bg-karios-green/10 text-karios-green text-xs px-2 py-0.5 rounded-full font-medium">
                                {readyTools.length}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                              {readyTools.map((tool, index) => (
                                <div
                                  key={`ready-${index}`}
                                  className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md hover:border-karios-green/30 transition-all h-fit self-start"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-medium text-gray-900 truncate">
                                            {tool.name}
                                          </h4>
                                          {/* Status Badge right next to tool name */}
                                          {validateAllToolsParameters(tool) ? (
                                            <div className="flex items-center gap-1 bg-karios-green/10 text-karios-green px-2 py-1 rounded text-xs font-medium flex-shrink-0">
                                              <svg
                                                className="w-3 h-3"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                              Ready
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium flex-shrink-0">
                                              <svg
                                                className="w-3 h-3"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                              Configure
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-1">
                                          {tool.description}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Compact Configuration Form */}
                                  {tool.name === 'ktrace' ? (
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                          Type <span className="text-red-400">*</span>
                                        </label>
                                        <select
                                          value={
                                            allToolsParameters[tool.name]?.traceType || 'Command'
                                          }
                                          onChange={(e) => {
                                            const traceType = e.target.value as 'Command' | 'PID';
                                            handleAllToolsParameterChange(
                                              tool.name,
                                              'traceType',
                                              traceType
                                            );
                                            if (traceType === 'Command') {
                                              handleAllToolsParameterChange(
                                                tool.name,
                                                'command',
                                                'ls'
                                              );
                                            } else {
                                              handleAllToolsParameterChange(
                                                tool.name,
                                                'pid',
                                                '1234'
                                              );
                                            }
                                          }}
                                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-karios-green focus:border-karios-green bg-white appearance-none cursor-pointer"
                                          style={{
                                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                            backgroundPosition: 'right 8px center',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundSize: '16px',
                                          }}
                                        >
                                          <option value="Command">Command</option>
                                          <option value="PID">PID</option>
                                        </select>
                                      </div>

                                      {allToolsParameters[tool.name]?.traceType === 'Command' ? (
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Command <span className="text-red-400">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            value={allToolsParameters[tool.name]?.command || ''}
                                            onChange={(e) =>
                                              handleAllToolsParameterChange(
                                                tool.name,
                                                'command',
                                                e.target.value
                                              )
                                            }
                                            placeholder="Enter command"
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-green"
                                          />
                                        </div>
                                      ) : (
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">
                                            PID <span className="text-red-400">*</span>
                                          </label>
                                          <div className="relative">
                                            <input
                                              type="text"
                                              value={allToolsParameters[tool.name]?.pid || ''}
                                              onChange={(e) =>
                                                handleAllToolsParameterChange(
                                                  tool.name,
                                                  'pid',
                                                  e.target.value
                                                )
                                              }
                                              placeholder="Enter process ID"
                                              className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => toggleProcessList(tool.name)}
                                              disabled={loadingProcesses}
                                              className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                              title="Select from running processes"
                                            >
                                              <svg
                                                className="w-3 h-3 text-gray-400"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M19 9l-7 7-7-7"
                                                />
                                              </svg>
                                            </button>
                                          </div>

                                          {/* Process List Dropdown */}
                                          {showProcessList[tool.name] && (
                                            <div
                                              className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {loadingProcesses ? (
                                                <div className="p-2 text-xs text-gray-500 text-center">
                                                  Loading processes...
                                                </div>
                                              ) : processList.length > 0 ? (
                                                processList.map((process, idx) => (
                                                  <div
                                                    key={idx}
                                                    onClick={() => {
                                                      const pid =
                                                        process.pid ||
                                                        process.id ||
                                                        process.processId ||
                                                        String(process);
                                                      handleAllToolsParameterChange(
                                                        tool.name,
                                                        'pid',
                                                        String(pid)
                                                      );
                                                      setShowProcessList((prev) => ({
                                                        ...prev,
                                                        [tool.name]: false,
                                                      }));
                                                    }}
                                                    className="p-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                  >
                                                    <div className="font-medium">
                                                      PID:{' '}
                                                      {process.pid ||
                                                        process.id ||
                                                        process.processId ||
                                                        process}
                                                    </div>
                                                    {process.name && (
                                                      <div className="text-gray-600 truncate">
                                                        {process.name}
                                                      </div>
                                                    )}
                                                    {process.command && (
                                                      <div className="text-gray-500 truncate">
                                                        {process.command}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))
                                              ) : (
                                                <div className="p-2 text-xs text-gray-500 text-center">
                                                  No processes found
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : tool.parameters && tool.parameters.length > 0 ? (
                                    <div
                                      className={`grid gap-2 ${tool.parameters.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                                    >
                                      {tool.parameters.map((param, paramIndex) => (
                                        <div key={paramIndex}>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">
                                            {param.label}
                                            {param.required && (
                                              <span className="text-red-400 ml-1">*</span>
                                            )}
                                          </label>
                                          {param.name.toLowerCase().includes('pid') ||
                                          param.label.toLowerCase().includes('process') ? (
                                            <div className="relative">
                                              <input
                                                type="text"
                                                value={
                                                  allToolsParameters[tool.name]?.[param.name] || ''
                                                }
                                                onChange={(e) =>
                                                  handleAllToolsParameterChange(
                                                    tool.name,
                                                    param.name,
                                                    e.target.value
                                                  )
                                                }
                                                placeholder={`Enter ${param.label.toLowerCase()}`}
                                                className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => toggleProcessList(tool.name)}
                                                disabled={loadingProcesses}
                                                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                title="Select from running processes"
                                              >
                                                <svg
                                                  className="w-3 h-3 text-gray-400"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 9l-7 7-7-7"
                                                  />
                                                </svg>
                                              </button>

                                              {/* Process List Dropdown for PID parameters */}
                                              {showProcessList[tool.name] && (
                                                <div
                                                  className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {loadingProcesses ? (
                                                    <div className="p-2 text-xs text-gray-500 text-center">
                                                      Loading processes...
                                                    </div>
                                                  ) : processList.length > 0 ? (
                                                    processList.map((process, idx) => (
                                                      <div
                                                        key={idx}
                                                        onClick={() => {
                                                          const pid =
                                                            process.pid ||
                                                            process.id ||
                                                            process.processId ||
                                                            String(process);
                                                          handleAllToolsParameterChange(
                                                            tool.name,
                                                            param.name,
                                                            String(pid)
                                                          );
                                                          setShowProcessList((prev) => ({
                                                            ...prev,
                                                            [tool.name]: false,
                                                          }));
                                                        }}
                                                        className="p-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                      >
                                                        <div className="font-medium">
                                                          PID:{' '}
                                                          {process.pid ||
                                                            process.id ||
                                                            process.processId ||
                                                            process}
                                                        </div>
                                                        {(process.comm || process.name) && (
                                                          <div className="text-gray-600 truncate">
                                                            {process.comm || process.name}
                                                          </div>
                                                        )}
                                                        {process.command && (
                                                          <div className="text-gray-500 truncate">
                                                            {process.command}
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))
                                                  ) : (
                                                    <div className="p-2 text-xs text-gray-500 text-center">
                                                      No processes found
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              value={
                                                allToolsParameters[tool.name]?.[param.name] || ''
                                              }
                                              onChange={(e) =>
                                                handleAllToolsParameterChange(
                                                  tool.name,
                                                  param.name,
                                                  e.target.value
                                                )
                                              }
                                              placeholder={`Enter ${param.label.toLowerCase()}`}
                                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-karios-green"
                                            />
                                          )}
                                          {param.default && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                              Example: {param.default}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center"></div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tools that need configuration */}
                        {configTools.length > 0 && (
                          <div ref={requiresConfigurationRef}>
                            <div className="flex items-center gap-2 mb-3">
                              <svg
                                className="w-4 h-4 text-amber-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              <h4 className="text-sm font-medium text-gray-700">
                                Requires Configuration
                              </h4>
                              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                {configTools.length}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                              {configTools.map((tool, index) => (
                                <div
                                  key={index}
                                  onClick={() => {
                                    setSelectedTool(selectedTool === tool.name ? null : tool.name);
                                    // Close all configuration panels when selecting a different tool
                                    if (selectedTool !== tool.name) {
                                      setShowConfigPanel({});
                                    }
                                  }}
                                  className={`border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer h-fit self-start ${
                                    selectedTool === tool.name
                                      ? 'border-karios-green bg-karios-green/20 shadow-md ring-1 ring-karios-green/40'
                                      : 'border-gray-200 bg-white hover:border-karios-green/30'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-medium text-gray-900 truncate">
                                            {tool.name}
                                          </h4>
                                          {/* Status Badge right next to tool name */}
                                          <div
                                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                                              validateAllToolsParameters(tool)
                                                ? 'bg-karios-green/10 text-karios-green'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}
                                          >
                                            <svg
                                              className="w-2 h-2"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              {validateAllToolsParameters(tool) ? (
                                                <path
                                                  fillRule="evenodd"
                                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                  clipRule="evenodd"
                                                />
                                              ) : (
                                                <path
                                                  fillRule="evenodd"
                                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                  clipRule="evenodd"
                                                />
                                              )}
                                            </svg>
                                            {validateAllToolsParameters(tool)
                                              ? 'Ready'
                                              : 'Configure'}
                                          </div>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-1">
                                          {tool.description}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Configure Gear Button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleConfigPanel(tool.name);
                                        }}
                                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                          showConfigPanel[tool.name]
                                            ? 'bg-amber-200 text-amber-800'
                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                                        }`}
                                        title="Configure parameters"
                                      >
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expandable Configuration Panel */}
                                  {showConfigPanel[tool.name] && (
                                    <div
                                      className="mt-4 pt-4 border-t border-gray-200"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {tool.name === 'ktrace' ? (
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                              Type <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                              value={
                                                allToolsParameters[tool.name]?.traceType ||
                                                'Command'
                                              }
                                              onChange={(e) => {
                                                const traceType = e.target.value as
                                                  | 'Command'
                                                  | 'PID';
                                                handleAllToolsParameterChange(
                                                  tool.name,
                                                  'traceType',
                                                  traceType
                                                );
                                                if (traceType === 'Command') {
                                                  handleAllToolsParameterChange(
                                                    tool.name,
                                                    'command',
                                                    'ls'
                                                  );
                                                } else {
                                                  handleAllToolsParameterChange(
                                                    tool.name,
                                                    'pid',
                                                    '1234'
                                                  );
                                                }
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white appearance-none cursor-pointer"
                                              style={{
                                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                                backgroundPosition: 'right 8px center',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundSize: '16px',
                                              }}
                                            >
                                              <option value="Command">Command</option>
                                              <option value="PID">PID</option>
                                            </select>
                                          </div>

                                          {allToolsParameters[tool.name]?.traceType ===
                                          'Command' ? (
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Command <span className="text-red-400">*</span>
                                              </label>
                                              <input
                                                type="text"
                                                value={allToolsParameters[tool.name]?.command || ''}
                                                onChange={(e) =>
                                                  handleAllToolsParameterChange(
                                                    tool.name,
                                                    'command',
                                                    e.target.value
                                                  )
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="Enter command"
                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                                              />
                                            </div>
                                          ) : (
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                PID <span className="text-red-400">*</span>
                                              </label>
                                              <div className="relative">
                                                <input
                                                  type="text"
                                                  value={allToolsParameters[tool.name]?.pid || ''}
                                                  onChange={(e) =>
                                                    handleAllToolsParameterChange(
                                                      tool.name,
                                                      'pid',
                                                      e.target.value
                                                    )
                                                  }
                                                  onClick={(e) => e.stopPropagation()}
                                                  placeholder="Enter process ID"
                                                  className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => toggleProcessList(tool.name)}
                                                  disabled={loadingProcesses}
                                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                  title="Select from running processes"
                                                >
                                                  <svg
                                                    className="w-3 h-3 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={2}
                                                      d="M19 9l-7 7-7-7"
                                                    />
                                                  </svg>
                                                </button>
                                              </div>

                                              {/* Process List Dropdown */}
                                              {showProcessList[tool.name] && (
                                                <div
                                                  className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {loadingProcesses ? (
                                                    <div className="p-2 text-xs text-gray-500 text-center">
                                                      Loading processes...
                                                    </div>
                                                  ) : processList.length > 0 ? (
                                                    processList.map((process, idx) => (
                                                      <div
                                                        key={idx}
                                                        onClick={() => {
                                                          const pid =
                                                            process.pid ||
                                                            process.id ||
                                                            process.processId ||
                                                            String(process);
                                                          handleAllToolsParameterChange(
                                                            tool.name,
                                                            'pid',
                                                            String(pid)
                                                          );
                                                          setShowProcessList((prev) => ({
                                                            ...prev,
                                                            [tool.name]: false,
                                                          }));
                                                        }}
                                                        className="p-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                      >
                                                        <div className="font-medium">
                                                          PID:{' '}
                                                          {process.pid ||
                                                            process.id ||
                                                            process.processId ||
                                                            process}
                                                        </div>
                                                        {process.name && (
                                                          <div className="text-gray-600 truncate">
                                                            {process.name}
                                                          </div>
                                                        )}
                                                        {process.command && (
                                                          <div className="text-gray-500 truncate">
                                                            {process.command}
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))
                                                  ) : (
                                                    <div className="p-2 text-xs text-gray-500 text-center">
                                                      No processes found
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : tool.parameters && tool.parameters.length > 0 ? (
                                        <div
                                          className={`grid gap-2 ${tool.parameters.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                                        >
                                          {tool.parameters.map((param, paramIndex) => (
                                            <div key={paramIndex}>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                {param.label}
                                                {param.required && (
                                                  <span className="text-red-400 ml-1">*</span>
                                                )}
                                              </label>
                                              {param.name.toLowerCase().includes('pid') ||
                                              param.label.toLowerCase().includes('process') ? (
                                                <div className="relative">
                                                  <input
                                                    type="text"
                                                    value={
                                                      allToolsParameters[tool.name]?.[param.name] ||
                                                      ''
                                                    }
                                                    onChange={(e) =>
                                                      handleAllToolsParameterChange(
                                                        tool.name,
                                                        param.name,
                                                        e.target.value
                                                      )
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder={`Enter ${param.label.toLowerCase()}`}
                                                    className="w-full px-2 py-1 pr-6 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleProcessList(tool.name)}
                                                    disabled={loadingProcesses}
                                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                                    title="Select from running processes"
                                                  >
                                                    <svg
                                                      className="w-3 h-3 text-gray-400"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 9l-7 7-7-7"
                                                      />
                                                    </svg>
                                                  </button>

                                                  {/* Process List Dropdown for PID parameters */}
                                                  {showProcessList[tool.name] && (
                                                    <div
                                                      className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded bg-white shadow-lg"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      {loadingProcesses ? (
                                                        <div className="p-2 text-xs text-gray-500 text-center">
                                                          Loading processes...
                                                        </div>
                                                      ) : processList.length > 0 ? (
                                                        processList.map((process, idx) => (
                                                          <div
                                                            key={idx}
                                                            onClick={() => {
                                                              const pid =
                                                                process.pid ||
                                                                process.id ||
                                                                process.processId ||
                                                                String(process);
                                                              handleAllToolsParameterChange(
                                                                tool.name,
                                                                param.name,
                                                                String(pid)
                                                              );
                                                              setShowProcessList((prev) => ({
                                                                ...prev,
                                                                [tool.name]: false,
                                                              }));
                                                            }}
                                                            className="p-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                          >
                                                            <div className="font-medium">
                                                              PID:{' '}
                                                              {process.pid ||
                                                                process.id ||
                                                                process.processId ||
                                                                process}
                                                            </div>
                                                            {(process.comm || process.name) && (
                                                              <div className="text-gray-600 truncate">
                                                                {process.comm || process.name}
                                                              </div>
                                                            )}
                                                            {process.command && (
                                                              <div className="text-gray-500 truncate">
                                                                {process.command}
                                                              </div>
                                                            )}
                                                          </div>
                                                        ))
                                                      ) : (
                                                        <div className="p-2 text-xs text-gray-500 text-center">
                                                          No processes found
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={
                                                    allToolsParameters[tool.name]?.[param.name] ||
                                                    ''
                                                  }
                                                  onChange={(e) =>
                                                    handleAllToolsParameterChange(
                                                      tool.name,
                                                      param.name,
                                                      e.target.value
                                                    )
                                                  }
                                                  onClick={(e) => e.stopPropagation()}
                                                  placeholder={`Enter ${param.label.toLowerCase()}`}
                                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
                                                />
                                              )}
                                              {param.default && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                  Example: {param.default}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {runAllInProgress && (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2"></div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Executing {debugTools.length} tools...
                        </p>
                        <p className="text-xs text-blue-700">Bulk execution in progress</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Message when tools are running or completed */}
        {(runningAll || Object.keys(allResults).length > 0) &&
          debugTools &&
          Array.isArray(debugTools) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className={`p-3 rounded-lg mr-4 ${runningAll ? 'bg-gray-100' : 'bg-gray-100'}`}
                  >
                    {runningAll ? (
                      <div className="animate-spin h-6 w-6 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                    ) : (
                      <svg
                        className="w-6 h-6 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {runningAll ? 'Executing All Debug Tools' : 'All Tools Execution Complete'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {runningAll
                        ? `Progress: ${Object.values(allResults).filter((r) => r.status === 'completed').length}/${debugTools.length} tools completed`
                        : `Successfully executed ${debugTools.length} debug tools`}
                    </p>
                    {!runningAll && (
                      <p className="text-xs text-gray-500 mt-1">
                        Use the Report Generation section above to create a comprehensive report
                      </p>
                    )}
                  </div>
                </div>
                {!runningAll && (
                  <button
                    onClick={() => {
                      setAllResults({});
                      setReportPath(null);
                      setReportError(null);
                      setExecutionFilePath(null);
                    }}
                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    Back to Tool Selection
                  </button>
                )}
              </div>
            </div>
          )}

        {debugTools && !Array.isArray(debugTools) && (
          <div className="bg-gray-50 border border-gray-200 text-gray-800 px-6 py-4 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-medium">Unexpected response format</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-yellow-700 hover:text-yellow-900">
                    View raw response
                  </summary>
                  <pre className="mt-2 text-xs bg-yellow-100 p-3 rounded overflow-auto max-h-48">
                    {JSON.stringify(debugTools, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Results Modal */}
        {showResultsModal && modalResult && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeResultsModal}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-xl w-full max-h-[75vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{modalResult.toolName}</h3>
                  <p className="text-xs text-gray-500">Output</p>
                </div>
                <button
                  onClick={closeResultsModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-hidden">
                {modalResult.error ? (
                  <div className="p-3">
                    <div className="bg-gray-50 border rounded p-3">
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Error</p>
                          <p className="text-xs text-gray-600 mt-1">{modalResult.error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="bg-gray-50 border rounded">
                      <div className="bg-gray-100 px-3 py-2 border-b flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Output</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(formatOutput(modalResult.result));
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded hover:bg-gray-200"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="p-3 overflow-auto max-h-60">
                        <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-gray-800">
                          {formatOutput(modalResult.result)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end p-3 border-t bg-gray-50">
                <button
                  onClick={closeResultsModal}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Debugging;

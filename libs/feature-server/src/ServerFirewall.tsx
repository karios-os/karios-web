import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaRegCopy, FaSave, FaTrash, FaUndo } from 'react-icons/fa';
import MonacoEditor from '@monaco-editor/react';
import type { editor, languages } from 'monaco-editor';
import { useServer, useFirewall, useAppState } from '@karios-monorepo/shared-state';
import api from '../../shared-state/src/utils/interceptor';
import { ActionTypes } from '../../shared-state/src/utils/actionTypes';
import { logger } from '../../shared-state/src/utils/logger';
import envConfig from '../../../runtime-config';
import {
  updateFirewallRules as updateFirewallRulesAPI,
  fetchNetworkInterfaces,
  fetchPacketFilters as fetchPacketFiltersAPI,
  generateFirewallRules,
} from '../../shared-state/src/utils/apiService';
import { useApprovalFlow } from '../../shared-state/src/hooks/useApprovalFlow';
import ApprovalModal from '../../shared-state/src/components/ApprovalModal';
import Tooltip from '../../shared-state/src/widgets/Tooltip';

// Monaco Editor type definitions
type IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
type ITextModel = editor.ITextModel;
type IMarkerData = editor.IMarkerData;
type Monaco = typeof import('monaco-editor');

// Interface definitions
interface ValidationResult {
  valid: boolean;
  message?: string;
}

interface ErrorDetails {
  syntaxError: string | null;
  portIssue: string | null;
}

const criticalPorts: number[] = [22, 80, 443, 8080, 8081, 8080];

// PF rule actions details with dependencies for dependent dropdowns - now only fallback structure, values come from API
// All hardcoded values have been removed - the component now relies entirely on API responses
const PF_RULE_ACTIONS_DETAILS = [
  {
    Value: 'pass',
    Label: 'Allow Traffic',
    Dependencies: {
      Directions: [],
      Protocols: [],
      States: [],
      SourceDest: [],
      AddressFamily: [],
      Interface: [],
      Options: [],
    },
  },
  {
    Value: 'block',
    Label: 'Deny Traffic',
    Dependencies: {
      Directions: [],
      Protocols: [],
      States: null,
      SourceDest: [],
      AddressFamily: [],
      Interface: [],
      Options: [],
    },
  },
  {
    Value: 'match',
    Label: 'Match Traffic',
    Dependencies: {
      Directions: [],
      Protocols: [],
      States: null,
      SourceDest: [],
      AddressFamily: [],
      Interface: null,
      Options: [],
    },
  },
  {
    Value: 'nat',
    Label: 'Network Address Translation',
    Dependencies: {
      Directions: [],
      Protocols: [],
      States: null,
      SourceDest: [],
      AddressFamily: null,
      Interface: [],
      Options: null,
    },
  },
  {
    Value: 'rdr',
    Label: 'Redirect Traffic',
    Dependencies: {
      Directions: [],
      Protocols: [],
      States: null,
      SourceDest: [],
      AddressFamily: null,
      Interface: [],
      Options: [],
    },
  },
  {
    Value: 'scrub',
    Label: 'Normalize Traffic',
    Dependencies: {
      Directions: [],
      Protocols: null,
      States: null,
      SourceDest: null,
      AddressFamily: [],
      Interface: [],
      Options: [],
    },
  },
  {
    Value: 'antispoof',
    Label: 'Prevent IP Spoofing',
    Dependencies: {
      Directions: [],
      Protocols: null,
      States: null,
      SourceDest: null,
      AddressFamily: null,
      Interface: [],
      Options: [],
    },
  },
];

// Helper function to extract specific error details from error messages
const extractErrorDetails = (errorMessage: string): ErrorDetails => {
  // Extract specific syntax errors like "syntax error" or "unknown protocol"
  const syntaxMatch = errorMessage.match(
    /syntax error|unknown protocol|unexpected|missing|undefined/i
  );
  const syntaxError = syntaxMatch ? syntaxMatch[0] : null;

  // Extract specific port issues
  const portMatch = errorMessage.match(/port\s+({[^}]+}|\d+(:\d+)?)/i);
  const portIssue = portMatch ? portMatch[2] : null;

  return { syntaxError, portIssue };
};

const extractPorts = (line: string): number[] => {
  const portMatch = line.match(/port\s+({[^}]+}|\d+(:\d+)?)/i);
  if (!portMatch) return [];
  const portText = portMatch[1];
  const parseSegment = (segment: string): number[] => {
    if (segment.includes(':')) {
      const [start, end] = segment.split(':').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
      return [];
    }
    const num = parseInt(segment.trim(), 10);
    return !isNaN(num) ? [num] : [];
  };
  if (portText.startsWith('{')) {
    const segments = portText.replace(/[{}]/g, '').split(',');
    return segments.flatMap(parseSegment);
  }
  return parseSegment(portText);
};

// Parse raw firewall rule line and extract all components respecting PF syntax order
const parseFirewallRule = (rawLine: string) => {
  if (!rawLine || typeof rawLine !== 'string') {
    return {
      action: '',
      direction: '',
      interface: '',
      addressFamily: '',
      protocol: '',
      from: '',
      to: '',
      port: '',
      state: '',
      options: '',
    };
  }

  const trimmed = rawLine.trim();
  logger.debug('Parsing PF rule following syntax order', { rule: trimmed });

  let remaining = trimmed;
  const result: any = {
    action: '',
    direction: '',
    interface: '',
    addressFamily: '',
    protocol: '',
    from: '',
    to: '',
    port: '',
    state: '',
    options: '',
  };

  // Step 1: Extract action (pass, block, match, scrub, antispoof) - always first
  const actionMatch = remaining.match(/^(\w+)/);
  if (actionMatch) {
    result.action = actionMatch[1];
    remaining = remaining.replace(actionMatch[0], '').trim();
    logger.debug('Parsed action', { action: result.action });
  }

  // Step 2: Extract early options (log, quick, and pass for rdr/nat) - can appear right after action
  let earlyOptionsPattern;
  if (result.action === 'rdr' || result.action === 'nat') {
    // For rdr/nat, also include 'pass' as an early option
    earlyOptionsPattern = /^((?:log\s+)?(?:quick\s+)?(?:pass\s+)?)/;
  } else {
    // For other actions, only log and quick
    earlyOptionsPattern = /^((?:log\s+)?(?:quick\s+)?)/;
  }

  const earlyOptionsMatch = remaining.match(earlyOptionsPattern);
  if (earlyOptionsMatch && earlyOptionsMatch[1].trim()) {
    const earlyOptions = earlyOptionsMatch[1].trim();
    if (earlyOptions.includes('log')) result.options += (result.options ? ' ' : '') + 'log';
    if (earlyOptions.includes('quick')) result.options += (result.options ? ' ' : '') + 'quick';
    if (earlyOptions.includes('pass') && (result.action === 'rdr' || result.action === 'nat')) {
      result.options += (result.options ? ' ' : '') + 'pass';
    }
    remaining = remaining.replace(earlyOptionsMatch[0], '').trim();
    logger.debug('Parsed early options', { options: earlyOptions.trim() });
  }

  // Step 3: Extract direction (in, out, all) - comes after action/early options
  const directionMatch = remaining.match(/^(in|out|all)/);
  if (directionMatch) {
    result.direction = directionMatch[1];
    remaining = remaining.replace(directionMatch[0], '').trim();
    logger.debug('Parsed direction', { direction: result.direction });
  }

  // Step 4 & 5: Extract interface and address family - order depends on action type
  if (result.action === 'nat' || result.action === 'antispoof') {
    // For NAT and antispoof rules: Interface comes before Address Family
    // Step 4: Extract interface (for <iface> or on <iface>) - comes after direction
    const forInterfaceMatch = remaining.match(/^for\s+([^\s]+)/);
    const onInterfaceMatch = remaining.match(/^on\s+([^\s]+)/);

    if (forInterfaceMatch) {
      result.interface = forInterfaceMatch[1];
      remaining = remaining.replace(forInterfaceMatch[0], '').trim();
      logger.debug('Parsed interface (for)', { interface: result.interface });
    } else if (onInterfaceMatch) {
      result.interface = onInterfaceMatch[1];
      remaining = remaining.replace(onInterfaceMatch[0], '').trim();
      logger.debug('Parsed interface (on)', { interface: result.interface });
    }

    // Step 5: Extract address family (inet, inet6) - comes after interface
    const addressFamilyMatch = remaining.match(/^(inet6?|inet)/);
    if (addressFamilyMatch) {
      result.addressFamily = addressFamilyMatch[1].toLowerCase();
      remaining = remaining.replace(addressFamilyMatch[0], '').trim();
      logger.debug('Parsed address family', { addressFamily: result.addressFamily });
    }
  } else {
    // For all other rules: Address Family comes before Interface
    // Step 4: Extract address family (inet, inet6) - comes after direction
    const addressFamilyMatch = remaining.match(/^(inet6?|inet)/);
    if (addressFamilyMatch) {
      result.addressFamily = addressFamilyMatch[1].toLowerCase();
      remaining = remaining.replace(addressFamilyMatch[0], '').trim();
      logger.debug('Parsed address family', { addressFamily: result.addressFamily });
    }

    // Step 5: Extract interface (for <iface> or on <iface>) - comes after address family
    const forInterfaceMatch = remaining.match(/^for\s+([^\s]+)/);
    const onInterfaceMatch = remaining.match(/^on\s+([^\s]+)/);

    if (forInterfaceMatch) {
      result.interface = forInterfaceMatch[1];
      remaining = remaining.replace(forInterfaceMatch[0], '').trim();
      logger.debug('Parsed interface (for)', { interface: result.interface });
    } else if (onInterfaceMatch) {
      result.interface = onInterfaceMatch[1];
      remaining = remaining.replace(onInterfaceMatch[0], '').trim();
      logger.debug('Parsed interface (on)', { interface: result.interface });
    }
  }

  // Step 6: Extract protocol (proto <proto>) - comes after address family
  const protocolMatch = remaining.match(/^proto\s+(\w+)/);
  if (protocolMatch) {
    result.protocol = protocolMatch[1];
    remaining = remaining.replace(protocolMatch[0], '').trim();
    logger.debug('Parsed protocol', { protocol: result.protocol });
  }

  // Step 7: Extract match criteria for scrub rules
  // For scrub rules, we might have match criteria like "all" before options
  if (result.action === 'scrub') {
    const scrubMatchMatch = remaining.match(/^all(?=\s|$)/);
    if (scrubMatchMatch) {
      // For scrub, "all" is match criteria, not a direction
      if (result.direction === 'all') {
        // Keep it as direction for now, but don't treat remaining "all" as duplicate
      } else {
        result.from = 'all'; // Store as source for scrub rules
      }
      remaining = remaining.replace(scrubMatchMatch[0], '').trim();
      logger.debug('Parsed scrub match criteria', { criteria: 'all' });
    }
  }

  // Step 8: Extract source and destination (from ... to ...) - comes after protocol
  // Handle from ... to ... pattern
  const fromToMatch = remaining.match(
    /^from\s+(.+?)\s+to\s+(.+?)(?=\s+(?:port|state|redirect|options|->|$))/
  );
  if (fromToMatch) {
    result.from = fromToMatch[1].trim();
    result.to = fromToMatch[2].trim();
    remaining = remaining.replace(fromToMatch[0], '').trim();
    logger.debug('Parsed source and destination', { from: result.from, to: result.to });
  } else {
    // Try just 'from' if no 'to'
    const fromOnlyMatch = remaining.match(/^from\s+(.+?)(?=\s+(?:to|port|state|options|->|$))/);
    if (fromOnlyMatch) {
      result.from = fromOnlyMatch[1].trim();
      remaining = remaining.replace(fromOnlyMatch[0], '').trim();
      logger.debug('Parsed source only', { from: result.from });
    }

    // Try just 'to' if no 'from'
    const toOnlyMatch = remaining.match(/^to\s+(.+?)(?=\s+(?:port|state|options|->|$))/);
    if (toOnlyMatch) {
      result.to = toOnlyMatch[1].trim();
      remaining = remaining.replace(toOnlyMatch[0], '').trim();
      logger.debug('Parsed destination only', { to: result.to });
    }
  }

  // Step 8.5: Extract redirect information for NAT and RDR rules
  if (result.action === 'nat' || result.action === 'rdr') {
    // Look for redirect pattern like "-> 127.0.0.1 port 8021"
    const redirectMatch = remaining.match(/^->\s+(.+?)(?=\s+(?:port|state|options|$))/);
    if (redirectMatch) {
      // Store only the target part, not the "->" prefix
      result.redirect = redirectMatch[1].trim();
      remaining = remaining.replace(redirectMatch[0], '').trim();
      logger.debug('Parsed redirect', { redirect: result.redirect });
    }
  }

  // Step 9: Extract port - comes after from/to
  const portMatch = remaining.match(
    /^port\s+(?:\{([^}]+)\}|([^\s]+(?:\s+[^\s]+)*?))(?=\s+(?:state|redirect|options|$))/
  );
  if (portMatch) {
    result.port = (portMatch[1] || portMatch[2] || '').trim();
    remaining = remaining.replace(portMatch[0], '').trim();
    logger.debug('Parsed port', { port: result.port });
  }

  // Step 10: Extract state - comes after port
  const stateMatch = remaining.match(/^state\s+(.+?)(?=\s+redirect|options|$)/);
  if (stateMatch) {
    result.state = stateMatch[1].trim();
    remaining = remaining.replace(stateMatch[0], '').trim();
    logger.debug('Parsed state', { state: result.state });
  }

  // Step 11: Extract remaining options - EVERYTHING ELSE GOES TO OPTIONS (LAST)
  if (remaining) {
    // For scrub rules, remaining content is likely options
    let finalOptions = remaining.trim();

    // Remove any trailing keywords that shouldn't be in options
    finalOptions = finalOptions.replace(
      /\s+(?:from|to|port|state|proto|on|for|inet|inet6)\s+.*$/,
      ''
    );

    if (finalOptions) {
      // Merge with any existing options
      result.options += (result.options ? ' ' : '') + finalOptions;
      result.options = result.options.trim();
      logger.debug('Parsed final options', { options: result.options });
    }
  }

  logger.debug('PF rule parsing completed', result);
  return result;
};

// Helper function to debug sync issues
const debugSyncIssue = (
  fieldName: string,
  parsedValue: any,
  validationResult: any,
  availableOptions: any,
  element: any
) => {
  if (!element) {
    logger.warn('Sync issue: DOM element not found', { fieldName, parsedValue, validationResult });
  } else if (!parsedValue && !validationResult) {
    logger.debug('Sync debug', { fieldName, status: 'no value to sync' });
  }
};

// Validate parsed values against apiOptions with smart fallbacks
const validateAgainstApiOptions = (
  parsedComponents: any,
  apiOptions: any,
  selectedAction: string,
  derivedAddressFamily: any,
  derivedOptions: any
) => {
  const validated: any = {
    action: '',
    direction: '',
    addressFamily: '',
    protocol: '',
    state: '',
    options: '',
  };

  logger.debug('Validating parsed components against API options', {
    componentsCount: Object.keys(parsedComponents).length,
    hasApiOptions: !!apiOptions.pf_rule_actions_details,
    hasDerivedOptions: !!(derivedAddressFamily || derivedOptions),
  });

  // Validate action - try apiOptions first, fallback to raw value
  if (parsedComponents.action) {
    if (
      Array.isArray(apiOptions.pf_rule_actions_details) &&
      apiOptions.pf_rule_actions_details.length > 0
    ) {
      const validAction = apiOptions.pf_rule_actions_details.find(
        (a: any) => a.Value === parsedComponents.action
      );
      if (validAction) {
        validated.action = parsedComponents.action;
        logger.debug('Action validated', { action: parsedComponents.action });
      } else {
        logger.debug('Action not found in API options', { action: parsedComponents.action });
      }
    } else {
      // If no apiOptions available, accept raw value
      validated.action = parsedComponents.action;
      logger.debug('Action accepted without validation', { action: parsedComponents.action });
    }
  }

  // Validate direction - try apiOptions first, fallback to raw value
  if (parsedComponents.direction) {
    if (apiOptions.rule_directions && Array.isArray(apiOptions.rule_directions)) {
      if (apiOptions.rule_directions.includes(parsedComponents.direction)) {
        validated.direction = parsedComponents.direction;
        logger.debug('Direction validated', { direction: parsedComponents.direction });
      } else {
        logger.debug('Direction not in API options', { direction: parsedComponents.direction });
      }
    } else {
      // If no apiOptions available, accept raw value
      validated.direction = parsedComponents.direction;
      logger.debug('Direction accepted without validation', {
        direction: parsedComponents.direction,
      });
    }
  }

  // Validate address family - smart fallback logic
  if (parsedComponents.addressFamily) {
    if (
      derivedAddressFamily &&
      Array.isArray(derivedAddressFamily) &&
      derivedAddressFamily.length > 0
    ) {
      if (derivedAddressFamily.includes(parsedComponents.addressFamily)) {
        validated.address_family = parsedComponents.addressFamily;
        logger.debug('Address family validated', { addressFamily: parsedComponents.addressFamily });
      }
    }

    // If not validated yet, try fallback logic
    if (!validated.address_family) {
      const validFamilies = ['inet', 'inet6'];
      if (validFamilies.includes(parsedComponents.addressFamily)) {
        validated.address_family = parsedComponents.addressFamily;
        logger.debug('Address family accepted as valid', {
          addressFamily: parsedComponents.addressFamily,
        });
      }
    }
  }

  // Validate protocol - flexible approach
  if (parsedComponents.protocol) {
    let protocolValidated = false;

    if (
      Array.isArray(apiOptions.pf_rule_actions_details) &&
      apiOptions.pf_rule_actions_details.length > 0
    ) {
      const source = apiOptions.pf_rule_actions_details;
      const action = source.find((a: any) => a.Value === selectedAction);
      const protocols = action?.Dependencies?.Protocols || [];

      if (protocols.length > 0 && protocols.includes(parsedComponents.protocol)) {
        validated.protocol = parsedComponents.protocol;
        protocolValidated = true;
        logger.debug('Protocol validated against action dependencies', {
          protocol: parsedComponents.protocol,
        });
      }
    }

    if (
      !protocolValidated &&
      apiOptions.rule_protocols &&
      Array.isArray(apiOptions.rule_protocols)
    ) {
      if (apiOptions.rule_protocols.includes(parsedComponents.protocol)) {
        validated.protocol = parsedComponents.protocol;
        protocolValidated = true;
        logger.debug('Protocol validated against global protocols', {
          protocol: parsedComponents.protocol,
        });
      }
    }

    if (!protocolValidated) {
      // Accept common protocols even without apiOptions
      const commonProtocols = ['tcp', 'udp', 'icmp', 'icmp6'];
      if (commonProtocols.includes(parsedComponents.protocol)) {
        validated.protocol = parsedComponents.protocol;
        logger.debug('Protocol accepted as common', { protocol: parsedComponents.protocol });
      }
    }
  }

  // Validate state - flexible approach
  if (parsedComponents.state) {
    if (
      Array.isArray(apiOptions.pf_rule_actions_details) &&
      apiOptions.pf_rule_actions_details.length > 0
    ) {
      const source = apiOptions.pf_rule_actions_details;
      const action = source.find((a: any) => a.Value === selectedAction);
      const states = action?.Dependencies?.States || [];

      if (Array.isArray(states) && states.includes(parsedComponents.state)) {
        validated.state = parsedComponents.state;
        logger.debug('State validated', { state: parsedComponents.state });
      }
    } else {
      // Accept common states even without apiOptions
      const commonStates = ['flags', 'no-sync', 'synproxy'];
      if (commonStates.some((state) => parsedComponents.state.includes(state))) {
        validated.state = parsedComponents.state;
        logger.debug('State accepted as common', { state: parsedComponents.state });
      }
    }
  }

  // Validate options - most flexible approach
  if (parsedComponents.options) {
    let optionsValidated = false;

    if (derivedOptions && Array.isArray(derivedOptions) && derivedOptions.length > 0) {
      // Check if the entire options string matches any available option
      if (derivedOptions.includes(parsedComponents.options)) {
        validated.options = parsedComponents.options;
        optionsValidated = true;
        logger.debug('Options validated (exact match)', { options: parsedComponents.options });
      } else {
        // Check if any individual word in the options string matches available options
        const optionsWords = parsedComponents.options
          .split(/\s+/)
          .filter((word) => word.length > 0);
        const validWords = optionsWords.filter((word) => derivedOptions.includes(word));

        if (validWords.length > 0) {
          validated.options = validWords[0]; // Use first valid option
          optionsValidated = true;
          logger.debug('Options validated (partial match)', { options: validWords[0] });
        }
      }
    }

    if (!optionsValidated) {
      // Try common firewall options
      const optionsWords = parsedComponents.options.split(/\s+/).filter((word) => word.length > 0);
      const commonOptions = [
        'quick',
        'log',
        'keep',
        'modulate',
        'synproxy',
        'flags',
        'no-sync',
        'synproxy',
      ];
      const commonValid = optionsWords.find((word) => commonOptions.includes(word));

      if (commonValid) {
        validated.options = commonValid;
        logger.debug('Options accepted as common', { options: commonValid });
      } else if (optionsWords.length > 0) {
        // Accept first word as fallback
        validated.options = optionsWords[0];
        logger.debug('Options accepted as fallback', { options: optionsWords[0] });
      }
    }
  }

  // Return raw text values for fields that don't have dropdown validation
  return {
    ...validated,
    interface: parsedComponents.interface,
    from: parsedComponents.from,
    to: parsedComponents.to,
    port: parsedComponents.port,
  };
};

const ServerFirewall: React.FC = () => {
  const { selectedServer } = useServer();
  const { dispatch } = useAppState();
  const {
    firewall,
    fetchFirewallRules,
    updateFirewallRules,
    cancelFirewallRevert,
    setFirewallNotification,
    setFirewallRevertCountdown,
    setFirewallId,
  } = useFirewall();
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [localRules, setLocalRules] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSimpleMode, setIsSimpleMode] = useState<boolean>(true);
  const [selectedRuleType, setSelectedRuleType] = useState<string>('variable');
  const [packetFilters, setPacketFilters] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newFilters, setNewFilters] = useState<any[]>([]);
  const [nextLineNumber, setNextLineNumber] = useState<number>(1);
  const [selectedSetKey, setSelectedSetKey] = useState<string>('block-policy');
  const [toggleStatus, setToggleStatus] = useState<boolean>(true);
  const [serviceToggles, setServiceToggles] = useState<{ [key: string]: boolean }>({});
  const [isToggleMode, setIsToggleMode] = useState<boolean>(false);
  const hasRefreshedOnExpiryRef = useRef<boolean>(false);

  // Confirmation modal state for service toggles
  const [showToggleConfirmation, setShowToggleConfirmation] = useState<boolean>(false);
  const [pendingToggleAction, setPendingToggleAction] = useState<{
    serviceName: string;
    serviceIndex: number;
    newState: 'enabled' | 'disabled' | boolean;
    type?: 'anchor_template';
    serviceKey?: string;
    editingItem?: any;
    isEditMode?: boolean;
  } | null>(null);
  const [apiOptions, setApiOptions] = useState<any>({
    rule_actions: [],
    rule_directions: [],
    rule_protocols: [],
    rule_states: [],
    pf_rule_actions_details: [],
    toggle_constants: {},
    options_map: {},
    rule_templates: {},
  });
  const [selectedAction, setSelectedAction] = useState<string>('pass');
  const [debugModalOpen, setDebugModalOpen] = React.useState(false);
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [interfacesLoading, setInterfacesLoading] = useState<boolean>(false);
  const [generatedRules, setGeneratedRules] = useState<string | null>(null);
  const [isGeneratingRules, setIsGeneratingRules] = useState<boolean>(false);
  const [rulePreviewModalOpen, setRulePreviewModalOpen] = useState<boolean>(false);
  const [previewRules, setPreviewRules] = useState<string>('');
  const [editedRules, setEditedRules] = useState<string>('');
  const [isPreviewGenerating, setIsPreviewGenerating] = useState<boolean>(false);
  const [isEditingRules, setIsEditingRules] = useState<boolean>(false);
  const [tableValidationErrors, setTableValidationErrors] = useState<string[]>([]);
  const [formInteracted, setFormInteracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Normalize raw rule text for reliable equality comparison (collapse whitespace)
  const canonicalizeRaw = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  };

  // Handle undoing edit of an item
  const handleUndoEdit = (itemToRevert: any) => {
    if (!packetFilters?.items) return;
    setPacketFilters((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.line === itemToRevert.line && item.type === itemToRevert.type) {
          // If we have previous snapshot, restore it
          if (item.prevRaw !== undefined || item.prevContent !== undefined) {
            return {
              ...item,
              raw: item.prevRaw !== undefined ? item.prevRaw : item.raw,
              content: item.prevContent !== undefined ? item.prevContent : item.content,
              status: undefined,
              prevRaw: undefined,
              prevContent: undefined,
            };
          }
          // Fallback: just clear edited status
          return { ...item, status: undefined };
        }
        return item;
      }),
    }));
    setHasChanges(true);
  };

  // Normalize API-provided pf_rule_actions_details to a consistent structure (arrays only)
  const normalizePfRuleActionsDetails = (details: any[]): any[] => {
    const toArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim().length > 0) return [val];
      return [];
    };
    return (Array.isArray(details) ? details : []).map((entry) => {
      const deps = entry?.Dependencies || {};
      return {
        ...entry,
        Dependencies: {
          Directions: toArray(deps.Directions),
          Protocols: toArray(deps.Protocols),
          States: toArray(deps.States),
          SourceDest: toArray(deps.SourceDest),
          AddressFamily: toArray(deps.AddressFamily),
          Interface: toArray(deps.Interface),
          Options: toArray(deps.Options),
        },
      };
    });
  };

  // Derived dependent dropdown options based on selected action
  // Priority: 1) API-provided action-specific directions, 2) Generic API directions, 3) Empty array (no hardcoded fallback)
  const derivedDirections = useMemo(() => {
    // If rule_directions is null, hide the dropdown completely
    if (apiOptions.rule_directions === null) {
      return null;
    }

    const source =
      apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length
        ? apiOptions.pf_rule_actions_details
        : [];
    const action = source.find((a: any) => a.Value === selectedAction);
    const dirs = action?.Dependencies?.Directions || [];
    const fallbackDirs = apiOptions.rule_directions || [];
    const hasActionSpecificKey = !!(
      action &&
      action.Dependencies &&
      Object.prototype.hasOwnProperty.call(action.Dependencies, 'Directions')
    );

    // Debug logging for antispoof directions
    if (selectedAction === 'antispoof') {
      logger.debug('Antispoof action configuration', {
        hasActionDirections: dirs.length > 0,
        hasFallbackDirections: fallbackDirs.length > 0,
      });
    }

    // If the action defines a Directions key (even if empty), use it as-is to avoid unintended fallbacks
    // Only use global fallback when the action does not define Directions at all
    return hasActionSpecificKey ? dirs : fallbackDirs;
  }, [selectedAction, apiOptions.pf_rule_actions_details, apiOptions.rule_directions]);

  const derivedProtocols = useMemo(() => {
    // If rule_protocols is null, hide the dropdown completely
    if (apiOptions.rule_protocols === null) {
      return null;
    }

    const source =
      apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length
        ? apiOptions.pf_rule_actions_details
        : [];
    const action = source.find((a: any) => a.Value === selectedAction);
    const prots = action?.Dependencies?.Protocols || [];
    return prots.length ? prots : apiOptions.rule_protocols;
  }, [selectedAction, apiOptions.pf_rule_actions_details, apiOptions.rule_protocols]);

  const derivedStates = useMemo(() => {
    const source =
      apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length
        ? apiOptions.pf_rule_actions_details
        : [];
    const action = source.find((a: any) => a.Value === selectedAction);
    const sts = action?.Dependencies?.States;
    // If States is explicitly null, return null to hide the field
    if (action?.Dependencies?.States === null) {
      return null;
    }
    return Array.isArray(sts) ? sts : [];
  }, [selectedAction, apiOptions.pf_rule_actions_details]);

  const derivedOptions = useMemo(() => {
    const source =
      apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length
        ? apiOptions.pf_rule_actions_details
        : [];
    const action = source.find((a: any) => a.Value === selectedAction);
    const opts = action?.Dependencies?.Options;
    // If Options is explicitly null, return null to hide the field
    if (action?.Dependencies?.Options === null) {
      return null;
    }
    return Array.isArray(opts) ? opts : [];
  }, [selectedAction, apiOptions.pf_rule_actions_details]);

  const derivedAddressFamily = useMemo(() => {
    const source =
      apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length
        ? apiOptions.pf_rule_actions_details
        : [];
    const action = source.find((a: any) => a.Value === selectedAction);
    const families = action?.Dependencies?.AddressFamily;
    // If AddressFamily is explicitly null, return null to hide the field
    if (action?.Dependencies?.AddressFamily === null) {
      return null;
    }
    return Array.isArray(families) ? families : [];
  }, [selectedAction, apiOptions.pf_rule_actions_details]);

  // Get available actions from API or return empty array (no hardcoded fallback)
  const availableActions = useMemo(() => {
    // If pf_rule_actions_details is null, return null to hide the dropdown
    if (apiOptions.pf_rule_actions_details === null) {
      return null;
    }

    if (apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length) {
      return apiOptions.pf_rule_actions_details.map((a: any) => a.Value);
    }
    // Return empty array instead of hardcoded fallback for better maintainability
    return [];
  }, [apiOptions.pf_rule_actions_details]);

  // Initialize selected action when editing or first render
  useEffect(() => {
    const initialAction =
      isEditMode && editingItem?.content?.action ? editingItem.content.action : 'pass';
    setSelectedAction(initialAction);
  }, [isEditMode, editingItem]);

  // Sync right-side form inputs with the currently editing item using dynamic apiOptions
  useEffect(() => {
    if (!isEditMode || !editingItem) return undefined;
    if (selectedRuleType !== 'rule') return undefined;

    logger.debug('Syncing form with editing item', {
      itemType: editingItem.type,
      selectedRuleType,
    });

    // Add a small delay to ensure DOM elements are ready
    const syncTimeout = setTimeout(() => {
      const dirEl = document.getElementById('rule-direction') as HTMLSelectElement | null;
      const addressFamilyEl = document.getElementById(
        'rule-address-family'
      ) as HTMLSelectElement | null;
      const ifaceEl = document.getElementById('rule-interface') as
        | HTMLSelectElement
        | HTMLInputElement
        | null;
      const protoEl = document.getElementById('rule-proto') as HTMLSelectElement | null;
      const fromEl = document.getElementById('rule-from') as HTMLSelectElement | null;
      const toEl = document.getElementById('rule-to') as HTMLSelectElement | null;
      const portEl = document.getElementById('rule-port') as HTMLInputElement | null;
      const stateEl = document.getElementById('rule-state') as HTMLSelectElement | null;
      const optionsEl = document.getElementById('rule-options') as HTMLSelectElement | null;

      // Use the API-provided parsed content directly
      const apiContent = editingItem.content || {};

      // Parse the raw rule to get correct values (API might have parsing issues)
      const clientParsed = parseFirewallRule(editingItem.raw || '');

      // Use client-side parsing for critical fields, fallback to API for others
      const validatedComponents: any = {
        action: clientParsed.action || apiContent.action || '',
        direction: clientParsed.direction || apiContent.direction || '',
        interface: clientParsed.interface || apiContent.interface || '',
        address_family: clientParsed.addressFamily || apiContent.address_family || '',
        proto: clientParsed.protocol || apiContent.proto || '',
        from: clientParsed.from || apiContent.from || '',
        to: clientParsed.to || apiContent.to || '',
        port:
          clientParsed.port ||
          (Array.isArray(apiContent.ports) ? apiContent.ports.join(', ') : apiContent.ports || ''),
        state: clientParsed.state || apiContent.state || '',
        options: clientParsed.options || apiContent.options || '',
        quick: apiContent.quick || false,
        log: apiContent.log || false,
        is_toggle: apiContent.is_toggle || false,
        toggle_names: apiContent.toggle_names || [],
        toggle_states: apiContent.toggle_states || [],
      };

      // Sync debug info (minimal)
      // Available options and DOM elements status

      // Field validation and sync

      // Set action dropdown (if available)
      const actionEl = document.getElementById('rule-action') as HTMLSelectElement | null;
      if (actionEl && validatedComponents.action) {
        // Check if action is in available options, or accept it anyway if validation failed
        const actionValid =
          availableActions && Array.isArray(availableActions)
            ? availableActions.includes(validatedComponents.action)
            : true; // Accept if no availableActions (apiOptions incomplete)

        if (actionValid) {
          actionEl.value = validatedComponents.action;
        } else {
          actionEl.value = validatedComponents.action; // Set anyway for better UX
        }
      }

      // Set direction dropdown (if available and visible)
      if (dirEl && validatedComponents.direction && validatedComponents.direction.trim() !== '') {
        // Check if direction is valid, or accept it anyway if apiOptions incomplete
        const directionValid =
          derivedDirections && Array.isArray(derivedDirections)
            ? derivedDirections.includes(validatedComponents.direction)
            : true; // Accept if no derivedDirections (apiOptions incomplete)

        if (directionValid) {
          dirEl.value = validatedComponents.direction;
        } else {
          dirEl.value = validatedComponents.direction; // Set anyway for better UX
        }
      }

      // Set address family dropdown (if available and visible)
      if (
        addressFamilyEl &&
        validatedComponents.address_family &&
        validatedComponents.address_family.trim() !== ''
      ) {
        // Check if the address family is valid
        if (
          derivedAddressFamily &&
          Array.isArray(derivedAddressFamily) &&
          derivedAddressFamily.includes(validatedComponents.address_family)
        ) {
          addressFamilyEl.value = validatedComponents.address_family;
        } else {
          // Even if not in derived list, try to set it if it's a valid inet/inet6 value
          const validFamilies = ['inet', 'inet6'];
          if (validFamilies.includes(validatedComponents.address_family)) {
            addressFamilyEl.value = validatedComponents.address_family;
          }
        }
      }

      // Set interface field - only if element exists AND is visible
      if (
        ifaceEl &&
        validatedComponents.interface &&
        validatedComponents.interface.trim() !== '' &&
        ifaceEl.offsetParent !== null
      ) {
        const interfaceSelect = ifaceEl as HTMLSelectElement;

        // Check if the value matches any predefined option, prioritizing variables
        const interfaceOptions = getInterfaceOptions();

        // First, check if it's already a variable (starts with $)
        let matchingOption = interfaceOptions.find(
          (option) => option.value === validatedComponents.interface
        );

        // If not found and it's not already a variable, check if it matches a variable's actual value
        if (!matchingOption && !validatedComponents.interface.startsWith('$')) {
          const availableVariables = getAvailableVariables();
          const matchingVariable = availableVariables.find(
            (variable) => variable.value === validatedComponents.interface
          );

          if (matchingVariable) {
            // Found a variable that matches the actual value, use the variable
            matchingOption = interfaceOptions.find(
              (option) => option.value === `$${matchingVariable.name}` && option.type === 'variable'
            );
          }
        }

        if (matchingOption) {
          // Value matches a predefined option or variable
          interfaceSelect.value = matchingOption.value;
        } else {
          // Value doesn't match any option, set it directly (might be a custom interface)
          interfaceSelect.value = validatedComponents.interface;
        }
      }

      // Set protocol dropdown (if available and visible)
      if (protoEl && validatedComponents.protocol && validatedComponents.protocol.trim() !== '') {
        // Check if protocol is valid, or accept it anyway if apiOptions incomplete
        const protocolValid =
          derivedProtocols && Array.isArray(derivedProtocols)
            ? derivedProtocols.includes(validatedComponents.protocol)
            : true; // Accept if no derivedProtocols (apiOptions incomplete)

        if (protocolValid) {
          protoEl.value = validatedComponents.protocol;
        } else {
          protoEl.value = validatedComponents.protocol; // Set anyway for better UX
        }
      }

      // Set source field - only if element exists AND is visible
      if (
        fromEl &&
        validatedComponents.from &&
        validatedComponents.from.trim() !== '' &&
        fromEl.offsetParent !== null
      ) {
        const fromSelect = fromEl;
        const fromCustomInput = document.getElementById('rule-from-custom') as HTMLInputElement;

        // Check if the value matches any predefined option, prioritizing variables
        const sourceDestOptions = getSourceDestOptions();

        // First, check if it's already a variable (starts with $)
        let matchingOption = sourceDestOptions.find(
          (option) => option.value === validatedComponents.from
        );

        // If not found and it's not already a variable, check if it matches a variable's actual value
        if (!matchingOption && !validatedComponents.from.startsWith('$')) {
          const availableVariables = getAvailableVariables();
          const matchingVariable = availableVariables.find(
            (variable) => variable.value === validatedComponents.from
          );

          if (matchingVariable) {
            // Found a variable that matches the actual value, use the variable
            matchingOption = sourceDestOptions.find(
              (option) => option.value === `$${matchingVariable.name}` && option.type === 'variable'
            );
          }
        }

        if (matchingOption) {
          // Value matches a predefined option or variable
          fromSelect.value = matchingOption.value;
          if (fromCustomInput) {
            fromCustomInput.style.display = 'none';
          }
        } else {
          // Value doesn't match any predefined option, use custom
          fromSelect.value = 'custom';
          if (fromCustomInput) {
            fromCustomInput.value = validatedComponents.from;
            fromCustomInput.style.display = 'block';
          }
        }
      }

      // Set destination field - only if element exists AND is visible
      if (
        toEl &&
        validatedComponents.to &&
        validatedComponents.to.trim() !== '' &&
        toEl.offsetParent !== null
      ) {
        const toSelect = toEl;
        const toCustomInput = document.getElementById('rule-to-custom') as HTMLInputElement;

        // Check if the value matches any predefined option, prioritizing variables
        const sourceDestOptions = getSourceDestOptions();

        // First, check if it's already a variable (starts with $)
        let matchingOption = sourceDestOptions.find(
          (option) => option.value === validatedComponents.to
        );

        // If not found and it's not already a variable, check if it matches a variable's actual value
        if (!matchingOption && !validatedComponents.to.startsWith('$')) {
          const availableVariables = getAvailableVariables();
          const matchingVariable = availableVariables.find(
            (variable) => variable.value === validatedComponents.to
          );

          if (matchingVariable) {
            // Found a variable that matches the actual value, use the variable
            matchingOption = sourceDestOptions.find(
              (option) => option.value === `$${matchingVariable.name}` && option.type === 'variable'
            );
          }
        }

        if (matchingOption) {
          // Value matches a predefined option or variable
          toSelect.value = matchingOption.value;
          if (toCustomInput) {
            toCustomInput.style.display = 'none';
          }
        } else {
          // Value doesn't match any predefined option, use custom
          toSelect.value = 'custom';
          if (toCustomInput) {
            toCustomInput.value = validatedComponents.to;
            toCustomInput.style.display = 'block';
          }
        }
      }

      // Set port field - only if element exists AND is visible
      if (
        portEl &&
        validatedComponents.port &&
        validatedComponents.port.trim() !== '' &&
        portEl.offsetParent !== null
      ) {
        portEl.value = validatedComponents.port;
      }

      // Set state dropdown (if available and visible)
      if (stateEl && validatedComponents.state) {
        // Check if state is valid, or accept it anyway if apiOptions incomplete
        const stateValid =
          derivedStates && Array.isArray(derivedStates)
            ? derivedStates.includes(validatedComponents.state)
            : true; // Accept if no derivedStates (apiOptions incomplete)

        if (stateValid) {
          stateEl.value = validatedComponents.state;
          stateEl.disabled = false;
        } else {
          stateEl.value = validatedComponents.state; // Set anyway for better UX
          stateEl.disabled = false;
        }
      }

      // Set options dropdown (if available and visible)
      if (optionsEl && validatedComponents.options) {
        // Try to find a matching option in derivedOptions
        let optionToSet = '';

        if (derivedOptions && Array.isArray(derivedOptions)) {
          // First try exact match
          if (derivedOptions.includes(validatedComponents.options)) {
            optionToSet = validatedComponents.options;
          } else {
            // Try partial match with individual words
            const optionsWords = validatedComponents.options
              .split(/\s+/)
              .filter((word) => word.length > 0);
            const validWord = optionsWords.find((word) => derivedOptions.includes(word));
            if (validWord) {
              optionToSet = validWord;
            }
          }
        }

        // If no match in derivedOptions, use the validated component value anyway
        if (!optionToSet && validatedComponents.options) {
          optionToSet = validatedComponents.options;
        }

        if (optionToSet) {
          optionsEl.value = optionToSet;
        }
      }
      // Sync completed
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(syncTimeout);
  }, [
    isEditMode,
    editingItem,
    selectedRuleType,
    apiOptions,
    selectedAction,
    availableActions,
    derivedDirections,
    derivedProtocols,
    derivedStates,
    derivedOptions,
    derivedAddressFamily,
  ]);

  // When action changes, do not auto-select defaults; leave fields empty unless user chooses
  useEffect(() => {
    if (isEditMode) return; // Don't touch values if editing an item
    const stateEl = document.getElementById('rule-state') as HTMLSelectElement | null;
    if (stateEl) {
      // Enable/disable only; do not set a value implicitly
      stateEl.disabled = derivedStates.length === 0;
    }
  }, [selectedAction, derivedStates, isEditMode]);

  // Helper functions for service information
  const getServicePort = (serviceKey: string): string => {
    const portMap: { [key: string]: string } = {
      ssh: '22',
      ftp: '21',
      ftp_proxy: '2121',
      http: '80',
      https: '443',
      icmp: 'N/A',
    };
    return portMap[serviceKey] || 'N/A';
  };

  const getServiceDescription = (serviceKey: string): string => {
    const descriptionMap: { [key: string]: string } = {
      ssh: 'Secure Shell access',
      ftp: 'File Transfer Protocol',
      ftp_proxy: 'FTP through proxy',
      http: 'Web server (HTTP)',
      https: 'Secure web server',
      icmp: 'Ping and network diagnostics',
    };
    return descriptionMap[serviceKey] || 'Network service';
  };

  // Approval flow hook
  const {
    requiresApproval,
    approvers,
    isModalOpen: isApprovalModalOpen,
    modalProps,
    executeWithApproval,
    closeModal: closeApprovalModal,
  } = useApprovalFlow({
    title: 'Firewall Rules Update Approval Required',
    message:
      'This firewall rules update requires approval. Please select an approver from the list below.',
  });

  // Validate rules without showing errors
  // const validateRules = (rules: string): ValidationResult => {
  //   const lines = rules.split('\n');
  //   const passLines = lines.filter((line: string) => line.trim().startsWith('pass'));
  //   const blockLines = lines.filter((line: string) => line.trim().startsWith('block'));
  //   const passPorts = passLines.flatMap(extractPorts);
  //   const blockPorts = blockLines.flatMap(extractPorts);

  //   const missingCriticalPorts = criticalPorts.filter(port => !passPorts.includes(port));
  //   const blockedCriticalPorts = criticalPorts.filter(port => blockPorts.includes(port));

  //   if (missingCriticalPorts.length > 0) {
  //     return {
  //       valid: false,
  //       message: `Please add the following ports into the pass default ruleset as they are required for default system operation: ${missingCriticalPorts.join(', ')}`,
  //     };
  //   }

  //   if (blockedCriticalPorts.length > 0) {
  //     return {
  //       valid: false,
  //       message: `Please remove the following ports from the block default ruleset as they are required for default system operation: ${blockedCriticalPorts.join(', ')}`,
  //     };
  //   }

  //   return { valid: true };
  // };

  // Function to get the correct position for a new item based on type ordering
  const getCorrectPositionForNewItem = (itemType: string, existingItems: any[]): number => {
    // Define the type order: variable, set, table, scrub_rules, nat_rules, rdr_rules, anchors, anchor_templates, other_rules
    const typeOrder = [
      'variable',
      'set',
      'table',
      'scrub',
      'nat',
      'rdr',
      'anchor',
      'anchor_template',
      'rule',
    ];

    const itemTypeIndex = typeOrder.indexOf(itemType);
    if (itemTypeIndex === -1) {
      // Unknown type, place at end
      return (existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.line)) : 0) + 1;
    }

    // Find the position where this type should be inserted
    let targetLine = 1;

    // Look for items that should come before this type
    for (let i = 0; i < itemTypeIndex; i++) {
      const beforeType = typeOrder[i];
      const beforeItems = existingItems.filter((item) => item.type === beforeType);
      if (beforeItems.length > 0) {
        targetLine = Math.max(...beforeItems.map((item) => item.line)) + 1;
      }
    }

    // If this is a rule type, we need special handling based on the action
    if (itemType === 'scrub' || itemType === 'nat' || itemType === 'rdr' || itemType === 'rule') {
      // For rule types, we need to find the correct position based on the action
      let ruleItems: any[] = [];

      if (itemType === 'scrub') {
        ruleItems = existingItems.filter(
          (item) =>
            item.type === 'rule' &&
            (item.content?.action === 'scrub' ||
              item.raw?.includes('scrub') ||
              item.content?.gop_action === 'scrub')
        );
      } else if (itemType === 'nat') {
        ruleItems = existingItems.filter(
          (item) =>
            item.type === 'rule' &&
            (item.content?.action === 'nat' ||
              item.raw?.includes('nat') ||
              item.content?.gop_action === 'nat')
        );
      } else if (itemType === 'rdr') {
        ruleItems = existingItems.filter(
          (item) =>
            item.type === 'rule' &&
            (item.content?.action === 'rdr' ||
              item.raw?.includes('rdr') ||
              item.content?.gop_action === 'rdr')
        );
      } else if (itemType === 'rule') {
        // For other rules, find rules that are not scrub, nat, or rdr
        ruleItems = existingItems.filter(
          (item) =>
            item.type === 'rule' &&
            !(
              item.content?.action === 'scrub' ||
              item.raw?.includes('scrub') ||
              item.content?.gop_action === 'scrub'
            ) &&
            !(
              item.content?.action === 'nat' ||
              item.raw?.includes('nat') ||
              item.content?.gop_action === 'nat'
            ) &&
            !(
              item.content?.action === 'rdr' ||
              item.raw?.includes('rdr') ||
              item.content?.gop_action === 'rdr'
            )
        );
      }

      if (ruleItems.length > 0) {
        targetLine = Math.max(...ruleItems.map((item) => item.line)) + 1;
      }
    }

    // Special handling for anchor to ensure it comes after scrub/nat/rdr rules
    if (itemType === 'anchor') {
      // Find scrub, nat, and rdr rule items
      const specificRuleItems = existingItems.filter(
        (item) =>
          item.type === 'rule' &&
          (item.content?.action === 'scrub' ||
            item.raw?.includes('scrub') ||
            item.content?.gop_action === 'scrub' ||
            item.content?.action === 'nat' ||
            item.raw?.includes('nat') ||
            item.content?.gop_action === 'nat' ||
            item.content?.action === 'rdr' ||
            item.raw?.includes('rdr') ||
            item.content?.gop_action === 'rdr')
      );

      if (specificRuleItems.length > 0) {
        targetLine = Math.max(...specificRuleItems.map((item) => item.line)) + 1;
      }
    }

    // Special handling for anchor_template to ensure it comes after anchors
    if (itemType === 'anchor_template') {
      // Find anchor items
      const anchorItems = existingItems.filter((item) => item.type === 'anchor');

      if (anchorItems.length > 0) {
        targetLine = Math.max(...anchorItems.map((item) => item.line)) + 1;
      } else {
        // If no anchors, find scrub, nat, and rdr rule items
        const specificRuleItems = existingItems.filter(
          (item) =>
            item.type === 'rule' &&
            (item.content?.action === 'scrub' ||
              item.raw?.includes('scrub') ||
              item.content?.gop_action === 'scrub' ||
              item.content?.action === 'nat' ||
              item.raw?.includes('nat') ||
              item.content?.gop_action === 'nat' ||
              item.content?.action === 'rdr' ||
              item.raw?.includes('rdr') ||
              item.content?.gop_action === 'rdr')
        );

        if (specificRuleItems.length > 0) {
          targetLine = Math.max(...specificRuleItems.map((item) => item.line)) + 1;
        }
      }
    }

    return targetLine;
  };

  // Function to intelligently reorganize items by type order
  const reorganizeItemsByType = (items: any[]) => {
    logger.debug('Reorganizing firewall items by type', {
      totalItems: items.length,
      types: [...new Set(items.map((item) => item.type))],
    });

    // Separate rules into scrub rules, nat rules, rdr rules, and other rules
    const scrubRules: any[] = [];
    const natRules: any[] = [];
    const rdrRules: any[] = [];
    const otherRules: any[] = [];
    const otherItems: any[] = [];

    items.forEach((item) => {
      if (item.type === 'rule') {
        // Check if this is a scrub rule by looking at the content
        const isScrubRule =
          item.content?.action === 'scrub' ||
          item.raw?.includes('scrub') ||
          item.content?.gop_action === 'scrub';
        // Check if this is a nat rule
        const isNatRule =
          item.content?.action === 'nat' ||
          item.raw?.includes('nat') ||
          item.content?.gop_action === 'nat';
        // Check if this is a rdr (redirect) rule
        const isRdrRule =
          item.content?.action === 'rdr' ||
          item.raw?.includes('rdr') ||
          item.content?.gop_action === 'rdr';

        if (isScrubRule) {
          scrubRules.push(item);
        } else if (isNatRule) {
          natRules.push(item);
        } else if (isRdrRule) {
          rdrRules.push(item);
        } else {
          otherRules.push(item);
        }
      } else {
        otherItems.push(item);
      }
    });

    // Group other items by type
    const itemsByType: { [key: string]: any[] } = {};
    otherItems.forEach((item) => {
      if (!itemsByType[item.type]) {
        itemsByType[item.type] = [];
      }
      itemsByType[item.type].push(item);
    });

    // Sort items within each type by their original line numbers
    Object.keys(itemsByType).forEach((type) => {
      itemsByType[type].sort((a, b) => a.line - b.line);
    });
    scrubRules.sort((a, b) => a.line - b.line);
    natRules.sort((a, b) => a.line - b.line);
    rdrRules.sort((a, b) => a.line - b.line);
    otherRules.sort((a, b) => a.line - b.line);

    // Rebuild the array in the correct type order: variable, set, table, scrub_rules, nat_rules, rdr_rules, anchors, anchor_templates, other_rules
    const reorganizedItems: any[] = [];

    // Add variables, sets, tables
    ['variable', 'set', 'table'].forEach((type) => {
      if (itemsByType[type]) {
        reorganizedItems.push(...itemsByType[type]);
      }
    });

    // Add scrub rules

    reorganizedItems.push(...scrubRules);

    // Add nat rules

    reorganizedItems.push(...natRules);

    // Add rdr rules

    reorganizedItems.push(...rdrRules);

    // Add anchors after scrub/nat/rdr rules
    if (itemsByType['anchor']) {
      reorganizedItems.push(...itemsByType['anchor']);
    }

    // Add anchor templates after anchors
    if (itemsByType['anchor_template']) {
      reorganizedItems.push(...itemsByType['anchor_template']);
    }

    // Add other rules after anchor templates

    reorganizedItems.push(...otherRules);

    // Add any items of types not in the predefined order
    Object.keys(itemsByType).forEach((type) => {
      if (!['variable', 'set', 'table', 'anchor', 'anchor_template'].includes(type)) {
        reorganizedItems.push(...itemsByType[type]);
      }
    });

    // Recalculate line numbers to be sequential
    return recalculateLineNumbers(reorganizedItems);
  };

  // Fetch packet filters for simple mode
  const fetchPacketFilters = async () => {
    if (!selectedServer?.fqdn && !selectedServer?.ip) return;
    setLoading(true);
    try {
      const data = await fetchPacketFiltersAPI(selectedServer?.fqdn || selectedServer.ip, dispatch);

      // Reorganize items by type order before setting state
      if (data && data.items) {
        const reorganizedData = {
          ...data,
          items: reorganizeItemsByType(data.items),
        };
        setPacketFilters(reorganizedData);
      } else {
        setPacketFilters(data);
      }

      // Log API response summary
      logger.info('Firewall data fetched successfully', {
        serverIp: selectedServer?.fqdn || selectedServer.ip,
        totalItems: data?.items?.length || 0,
        hasRuleActions: !!data?.pf_rule_actions_details,
      });

      // Extract API options for dynamic dropdowns
      if (data) {
        const normalizedActions = normalizePfRuleActionsDetails(data.pf_rule_actions_details || []);
        logger.debug('Normalized PF rule actions', { actionCount: normalizedActions.length });
        setApiOptions({
          rule_actions: data.rule_actions || [],
          rule_directions: data.rule_directions || [],
          rule_protocols: data.rule_protocols || [],
          rule_states: data.rule_states || [],
          pf_rule_actions_details: normalizedActions,
          toggle_constants: data.toggle_constants || {},
          options_map: data.options_map || {},
          rule_templates: data.rule_templates || {},
        });
      }
    } catch (error) {
      logger.error('Failed to fetch packet filters', {
        serverIp: selectedServer?.fqdn || selectedServer.ip,
        error,
      });
      setFirewallNotification({
        message: 'Failed to fetch packet filters. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch rules on mount or when server changes
  useEffect(() => {
    if (selectedServer?.fqdn || selectedServer?.ip) {
      fetchFirewallRules(selectedServer?.fqdn || selectedServer.ip).then((rules: string) => {
        setLocalRules(rules || '');
        setHasChanges(false);
        setValidationError(null);
      });

      // Also fetch packet filters for simple mode
      if (isSimpleMode) {
        fetchPacketFilters();
      }

      // Fetch network interfaces for the Interface dropdown
      const fetchInterfaces = async () => {
        setInterfacesLoading(true);
        try {
          const data = await fetchNetworkInterfaces(
            selectedServer?.fqdn || selectedServer.ip,
            dispatch
          );
          if (data) {
            // Extract interface names from the data (data is an array of objects with id and name)
            const interfaceNames = data.map((item: any) =>
              typeof item === 'string' ? item : item.name
            );
            setInterfaces(Array.isArray(interfaceNames) ? interfaceNames : []);
          } else {
            setInterfaces([]);
          }
        } catch (e) {
          logger.error('Failed to fetch network interfaces', {
            serverIp: selectedServer?.fqdn || selectedServer.ip,
            error: e,
          });
          setInterfaces([]);
        } finally {
          setInterfacesLoading(false);
        }
      };
      fetchInterfaces();
    }
  }, [selectedServer?.fqdn, selectedServer?.ip]);

  // Fetch packet filters when switching to simple mode
  useEffect(() => {
    if (isSimpleMode && (selectedServer?.fqdn || selectedServer?.ip)) {
      fetchPacketFilters();
    }
  }, [isSimpleMode, selectedServer?.fqdn, selectedServer?.ip]);

  // Update next line number when packet filters are loaded
  useEffect(() => {
    if (packetFilters?.items && packetFilters.items.length > 0) {
      const maxLine = Math.max(...packetFilters.items.map((item: any) => item.line));
      setNextLineNumber(maxLine + 1);
    }
  }, [packetFilters]);

  // Handle populating set value dropdown based on selected option
  useEffect(() => {
    const keySelect = document.getElementById('set-key') as HTMLSelectElement;
    const valueSelect = document.getElementById('set-value') as HTMLSelectElement;

    if (keySelect && valueSelect) {
      const selectedKey = selectedSetKey;

      // Clear existing options
      valueSelect.innerHTML = '';

      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a value';
      valueSelect.appendChild(defaultOption);

      // Populate based on API options
      if (apiOptions.options_map[selectedKey]) {
        apiOptions.options_map[selectedKey].forEach((value: string) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          valueSelect.appendChild(option);
        });
      }

      // Set the value if editing
      if (isEditMode && editingItem?.content?.gop_value) {
        valueSelect.value = editingItem.content.gop_value;
      }
    }
  }, [selectedRuleType, selectedSetKey, isEditMode, editingItem, apiOptions]);

  // Update selectedSetKey when editing an item
  useEffect(() => {
    if (isEditMode && editingItem?.content?.gop_key) {
      setSelectedSetKey(editingItem.content.gop_key);
    }
  }, [isEditMode, editingItem]);

  // Update toggleStatus when editing an item
  useEffect(() => {
    if (isEditMode && editingItem?.content?.toggle_status) {
      setToggleStatus(editingItem.content.toggle_status === 'enabled');
    }
  }, [isEditMode, editingItem]);

  // Sync variable form fields when editing variable items
  useEffect(() => {
    if (isEditMode && editingItem?.type === 'variable') {
      const nameInput = document.getElementById('variable-name') as HTMLInputElement | null;
      const valueInput = document.getElementById('variable-value') as HTMLInputElement | null;

      if (nameInput && valueInput && editingItem.content) {
        const varName = Object.keys(editingItem.content)[0] || '';
        const varValue = Object.values(editingItem.content)[0] || '';

        nameInput.value = String(varName);
        valueInput.value = String(varValue);
      }
    }
  }, [isEditMode, editingItem]);

  // Sync interface dropdowns with available variables when editing any item
  useEffect(() => {
    if (!isEditMode || !editingItem) {
      return undefined;
    }

    // Add a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      // Update interface dropdowns to show all available variables
      const interfaceSelects = document.querySelectorAll(
        '#rule-interface'
      ) as NodeListOf<HTMLSelectElement>;

      if (interfaceSelects.length === 0) {
        logger.info('No interface selects found, skipping sync');
        return;
      }

      interfaceSelects.forEach((select) => {
        // Store the current value before clearing
        const currentValue = select.value;

        // Clear existing options except the first "Select an interface" option
        while (select.children.length > 1) {
          select.removeChild(select.lastChild!);
        }

        // Add all available interface options
        getInterfaceOptions().forEach((option) => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.display;
          optionElement.className = option.type === 'variable' ? 'text-blue-600' : '';
          select.appendChild(optionElement);
        });

        // Set the current value if it exists
        if (editingItem.content?.interface) {
          const interfaceValue = editingItem.content.interface;

          // Check if the interface value is a variable (starts with $)
          if (interfaceValue.startsWith('$')) {
            // It's already a variable name, use it as is
            select.value = interfaceValue;
          } else {
            // Always check if this value matches any variable's value first
            const matchingVariable = getAvailableVariables().find(
              (variable) => String(variable.value) === interfaceValue
            );

            if (matchingVariable) {
              // Always prioritize variable over system interface
              select.value = `$${matchingVariable.name}`;
            } else {
              // Only use system interface if no variable matches
              select.value = interfaceValue;
            }
          }
        } else if (currentValue) {
          // If no interface in editing item but there was a current value, restore it
          select.value = currentValue;
        }
      });
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(timeoutId);
  }, [isEditMode, editingItem, packetFilters]);

  // Sync set form fields when editing set items
  useEffect(() => {
    if (isEditMode && editingItem?.type === 'set') {
      const keySelect = document.getElementById('set-key') as HTMLSelectElement | null;
      const valueSelect = document.getElementById('set-value') as HTMLSelectElement | null;
      const customValueInput = document.getElementById(
        'set-value-custom'
      ) as HTMLInputElement | null;

      if (keySelect && editingItem.content?.gop_key) {
        keySelect.value = editingItem.content.gop_key;
      }

      if (editingItem.content?.gop_value) {
        const value = String(editingItem.content.gop_value);

        // Check if the value exists in the dropdown options
        if (
          valueSelect &&
          Array.from(valueSelect.options).some((option) => option.value === value)
        ) {
          valueSelect.value = value;
          if (customValueInput) customValueInput.value = '';
        } else if (customValueInput) {
          // Use custom value input if not in dropdown
          customValueInput.value = value;
          if (valueSelect) valueSelect.value = '';
        }
      }
    }
  }, [isEditMode, editingItem, apiOptions]);

  // Sync table form fields when editing table items
  useEffect(() => {
    if (isEditMode && editingItem?.type === 'table') {
      const nameInput = document.getElementById('table-name') as HTMLInputElement | null;
      const propertiesSelect = document.getElementById(
        'table-properties'
      ) as HTMLSelectElement | null;
      const entriesInput = document.getElementById('table-entries') as HTMLInputElement | null;

      if (nameInput && editingItem.content?.name) {
        nameInput.value = editingItem.content.name;
      }

      if (propertiesSelect && editingItem.content?.properties) {
        propertiesSelect.value = editingItem.content.properties;
      }

      if (entriesInput && editingItem.content?.entries) {
        entriesInput.value = Array.isArray(editingItem.content.entries)
          ? editingItem.content.entries.join(', ')
          : String(editingItem.content.entries);
      }
    }
  }, [isEditMode, editingItem]);

  // Sync service toggles when editing anchor template items
  useEffect(() => {
    if (isEditMode && editingItem?.type === 'anchor_template') {
      const newToggles = { ...serviceToggles };

      // Update toggle states based on the editing item's is_enabled property
      // For anchor templates, we use the is_enabled boolean directly
      if (editingItem.content?.is_enabled !== undefined) {
        // Only update the specific service that this anchor template controls
        // First check if we have a toggle_type to identify the service
        if (editingItem.content?.toggle_type) {
          newToggles[editingItem.content.toggle_type] = editingItem.content.is_enabled;
        } else {
          // Fallback: determine which service this anchor template is for based on content
          const rawContent = editingItem.content?.raw || editingItem.raw || '';

          // Check if this anchor template is for ftp_proxy or icmp based on the raw content
          if (rawContent.includes('ftp') || rawContent.includes('2121')) {
            newToggles['ftp_proxy'] = editingItem.content.is_enabled;
          } else if (rawContent.includes('icmp')) {
            newToggles['icmp'] = editingItem.content.is_enabled;
          }
        }
      }

      setServiceToggles(newToggles);
    }
  }, [isEditMode, editingItem]);

  // Initialize service toggles based on existing rules
  useEffect(() => {
    if (packetFilters?.items) {
      const newToggles: { [key: string]: boolean } = {};

      // Initialize all available toggle services as disabled by default
      Object.values(apiOptions.toggle_constants).forEach((serviceKey) => {
        newToggles[serviceKey as string] = false;
      });

      // Only enable services if we have very clear evidence they should be enabled
      // For now, start with all disabled to avoid false positives
      // Users can manually enable the services they want

      setServiceToggles(newToggles);
    }
  }, [packetFilters, apiOptions.toggle_constants]);

  // Initialize selectedSetKey when API options are loaded
  useEffect(() => {
    if (Object.keys(apiOptions.options_map).length > 0) {
      setSelectedSetKey(Object.keys(apiOptions.options_map)[0]);
    }
  }, [apiOptions.options_map]);

  // Handle clicking on packet filter item to edit
  const handleItemClick = (item: any) => {
    setEditingItem(item);
    setSelectedRuleType(item.type);
    setIsEditMode(true);
    setFormInteracted(false); // Reset form interaction state when entering edit mode
  };

  // Handle canceling edit mode
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingItem(null);
    setFormInteracted(false); // Reset form interaction state when canceling edit mode
  };

  // Handle saving edited item
  const handleSaveEdit = async () => {
    if (!editingItem) return;

    try {
      // Build updated content from the form controls based on type
      let updatedContent: any = editingItem.content || {};
      let updatedRaw: string = editingItem.raw || '';
      const type = editingItem.type;

      if (type === 'variable') {
        const nameInput = document.getElementById('variable-name') as HTMLInputElement | null;
        const valueInput = document.getElementById('variable-value') as HTMLInputElement | null;
        const varName = (nameInput?.value || '').trim();
        const varValue = (valueInput?.value || '').trim();
        if (varName) {
          updatedContent = { [varName]: varValue };
          updatedRaw = generateRawContent('variable', updatedContent);
        }
      } else if (type === 'set') {
        const keySelect = document.getElementById('set-key') as HTMLSelectElement | null;
        const customValue = document.getElementById('set-value-custom') as HTMLInputElement | null;
        const valueSelect = document.getElementById('set-value') as HTMLSelectElement | null;
        const gop_key = keySelect?.value || editingItem.content?.gop_key || '';
        const gop_value = (
          customValue?.value ||
          valueSelect?.value ||
          editingItem.content?.gop_value ||
          ''
        ).toString();
        updatedContent = { set: 'set', gop_key, gop_value };
        updatedRaw = generateRawContent('set', updatedContent);
      } else if (type === 'table') {
        const nameInput = document.getElementById('table-name') as HTMLInputElement | null;
        const propertiesSelect = document.getElementById(
          'table-properties'
        ) as HTMLSelectElement | null;
        const entriesInput = document.getElementById('table-entries') as HTMLInputElement | null;
        const name = (nameInput?.value || '').trim();
        const properties = propertiesSelect?.value ? [propertiesSelect.value] : [];
        const entries = (entriesInput?.value || '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        // Validate IP addresses for table entries
        if (entriesInput && entriesInput.value.trim()) {
          const validation = validateIPAddresses(entriesInput.value.trim());
          if (!validation.isValid) {
            setTableValidationErrors(validation.errors);
            return;
          }
        }

        // Clear validation errors
        setTableValidationErrors([]);

        updatedContent = { name, properties, entries };
        updatedRaw = generateRawContent('table', updatedContent);
      } else if (type === 'rule') {
        const actionSelect = document.getElementById('rule-action') as HTMLSelectElement | null;
        const directionSelect = document.getElementById(
          'rule-direction'
        ) as HTMLSelectElement | null;
        const addressFamilySelect = document.getElementById(
          'rule-address-family'
        ) as HTMLSelectElement | null;
        const interfaceInput = document.getElementById('rule-interface') as HTMLInputElement | null;
        const protoSelect = document.getElementById('rule-proto') as HTMLSelectElement | null;
        const fromInput = document.getElementById('rule-from') as HTMLInputElement | null;
        const toInput = document.getElementById('rule-to') as HTMLInputElement | null;
        const portInput = document.getElementById('rule-port') as HTMLInputElement | null;
        const stateSelect = document.getElementById('rule-state') as HTMLSelectElement | null;
        const optionsSelect = document.getElementById('rule-options') as HTMLSelectElement | null;
        // Get the current action to determine what fields are needed
        const currentAction = actionSelect?.value || editingItem.content?.action || 'pass';

        // Find the action details to know what fields are required
        const source =
          apiOptions.pf_rule_actions_details && apiOptions.pf_rule_actions_details.length
            ? apiOptions.pf_rule_actions_details
            : [];
        const actionDetails = source.find((a: any) => a.Value === currentAction);

        // Build form data based on what fields are actually visible for the current action
        const formData: any = {
          action: currentAction,
        };

        // Use form values if available, otherwise fall back to API content
        // Direction - always visible for all actions
        if (directionSelect && directionSelect.offsetParent !== null) {
          formData.direction = directionSelect.value || editingItem.content?.direction || '';
        }

        // Address Family - visible for scrub, check for others
        if (
          addressFamilySelect &&
          (currentAction === 'scrub' || addressFamilySelect.offsetParent !== null)
        ) {
          // Always use the current form value, even if it's empty
          formData.address_family = addressFamilySelect.value;
        }

        // Interface - visible for scrub and antispoof, check for others
        if (
          interfaceInput &&
          (currentAction === 'scrub' ||
            currentAction === 'antispoof' ||
            interfaceInput.offsetParent !== null)
        ) {
          // Always use the current form value, even if it's empty
          formData.interface = interfaceInput.value;
        }

        // Protocol - not visible for scrub/antispoof
        if (
          protoSelect &&
          currentAction !== 'scrub' &&
          currentAction !== 'antispoof' &&
          protoSelect.offsetParent !== null
        ) {
          // Always use the current form value, even if it's empty
          formData.proto = protoSelect.value;
        }

        // Source - not visible for scrub/antispoof
        if (
          fromInput &&
          currentAction !== 'scrub' &&
          currentAction !== 'antispoof' &&
          fromInput.offsetParent !== null
        ) {
          const fromSelect = document.getElementById('rule-from') as HTMLSelectElement;
          const fromCustomInput = document.getElementById('rule-from-custom') as HTMLInputElement;

          if (fromSelect && fromSelect.value === 'custom' && fromCustomInput) {
            formData.from = fromCustomInput.value;
          } else {
            formData.from = fromSelect?.value || '';
          }
        }

        // Destination - not visible for scrub/antispoof
        if (
          toInput &&
          currentAction !== 'scrub' &&
          currentAction !== 'antispoof' &&
          toInput.offsetParent !== null
        ) {
          const toSelect = document.getElementById('rule-to') as HTMLSelectElement;
          const toCustomInput = document.getElementById('rule-to-custom') as HTMLInputElement;

          if (toSelect && toSelect.value === 'custom' && toCustomInput) {
            formData.to = toCustomInput.value;
          } else {
            formData.to = toSelect?.value || '';
          }
        }

        // Port - check visibility and process accordingly
        if (portInput && portInput.offsetParent !== null) {
          formData.port = portInput.value;
        }

        // State - not visible for scrub/antispoof
        if (
          stateSelect &&
          currentAction !== 'scrub' &&
          currentAction !== 'antispoof' &&
          stateSelect.offsetParent !== null
        ) {
          const selectedState = stateSelect.value;
          formData.state = selectedState === 'none' ? '' : selectedState;
        }

        // Redirect - only visible for NAT and RDR rules
        if (currentAction === 'nat' || currentAction === 'rdr') {
          const redirectInput = document.getElementById('rule-redirect') as HTMLInputElement | null;
          if (redirectInput) {
            // Clean the redirect value by removing "->" prefix if it exists
            const redirectValue = redirectInput.value;
            formData.redirect = redirectValue.replace(/^->\s*/, '');
          }
        }

        // Options - visible for scrub and antispoof, check for others
        if (
          optionsSelect &&
          (currentAction === 'scrub' ||
            currentAction === 'antispoof' ||
            optionsSelect.offsetParent !== null)
        ) {
          formData.options = optionsSelect.value;
        }

        // Collect boolean checkbox values
        const quickCheckbox = document.getElementById('rule-quick') as HTMLInputElement | null;
        const logCheckbox = document.getElementById('rule-log') as HTMLInputElement | null;
        const passCheckbox = document.getElementById('rule-pass') as HTMLInputElement | null;

        if (quickCheckbox) {
          formData.quick = quickCheckbox.checked;
        }
        if (logCheckbox) {
          formData.log = logCheckbox.checked;
        }
        if (currentAction === 'rdr' && passCheckbox) {
          formData.pass = passCheckbox.checked;
        }

        // Handle toggle options for toggle rules
        if (editingItem.content?.is_toggle) {
          formData.is_toggle = true;

          // Preserve existing toggle names and states if they exist
          if (editingItem.content?.toggle_names) {
            formData.toggle_names = editingItem.content.toggle_names;
          }
          if (editingItem.content?.toggle_states) {
            formData.toggle_states = editingItem.content.toggle_states;
          }
        }

        const prospectiveRaw = generateRawContent('rule', formData);
        logger.info('Form data collected for', { currentAction, formData });
        logger.info('Generated raw content:', prospectiveRaw);

        // If nothing actually changed, do not update the item (avoid unintended diffs)
        if (canonicalizeRaw(editingItem.raw) === canonicalizeRaw(prospectiveRaw)) {
          setIsEditMode(false);
          setEditingItem(null);
          return;
        }

        updatedContent = formData;
        updatedRaw = prospectiveRaw;
      } else if (type === 'anchor') {
        const typeSelect = document.getElementById('anchor-type') as HTMLSelectElement | null;
        const nameInput = document.getElementById('anchor-name') as HTMLInputElement | null;
        const formData = {
          type: typeSelect?.value || editingItem.content?.type || 'nat-anchor',
          name: (nameInput?.value || editingItem.content?.name || '').trim(),
        };
        updatedContent = formData;
        updatedRaw = generateRawContent('anchor', formData);
      } else if (type === 'anchor_template') {
        // For anchor_template, use the current editingItem content directly
        // The toggle updates are already captured in editingItem.content
        updatedContent = editingItem.content || {};
        updatedRaw = editingItem.raw || '';
      }

      // For all types: if raw is unchanged, do not mark edited
      if (
        editingItem.raw &&
        updatedRaw &&
        canonicalizeRaw(editingItem.raw) === canonicalizeRaw(updatedRaw)
      ) {
        setIsEditMode(false);
        setEditingItem(null);
        return;
      }

      // Compose updated item with snapshot to allow undo
      const updatedItem = {
        ...editingItem,
        prevRaw: editingItem.raw,
        prevContent: editingItem.content,
        content: updatedContent,
        raw: updatedRaw,
        status: 'edited',
      };

      // Update the item in the packetFilters state
      setPacketFilters((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.line === editingItem.line && item.type === editingItem.type ? updatedItem : item
        ),
      }));

      // Mark has changes
      setHasChanges(true);

      // Close edit mode
      setIsEditMode(false);
      setEditingItem(null);
      setFormInteracted(false); // Reset form interaction state when saving
    } catch (error) {
      logger.error('Failed to save edited firewall item', {
        serverIp: selectedServer?.fqdn || selectedServer?.ip,
        itemType: editingItem?.type,
        error,
      });
      setFirewallNotification({
        message: 'Failed to save changes. Please try again.',
        type: 'error',
      });
    }
  };

  // Handle adding new filter
  const handleAddNewFilter = (type: string, formData: any) => {
    const newFilter = {
      type,
      line: null, // Don't assign line numbers for new items
      content: formData,
      raw: generateRawContent(type, formData),
      status: 'new', // Mark as new item
      // Preserve toggle_type for filtering purposes
      toggle_type: formData.toggle_type,
    };

    // Format the content according to the payload structure
    const formattedFilter = formatItemForPayload(newFilter, 0);

    if (formattedFilter) {
      // Ensure toggle_type is preserved in the formatted filter for filtering
      if (formData.toggle_type) {
        formattedFilter.toggle_type = formData.toggle_type;
      }
      setNewFilters((prev) => [...prev, formattedFilter]);
    }
    // Don't increment nextLineNumber for new items

    // Clear form inputs if not in edit mode
    if (!isEditMode) {
      // Clear form inputs based on type
      if (type === 'variable') {
        const nameInput = document.getElementById('variable-name') as HTMLInputElement;
        const valueInput = document.getElementById('variable-value') as HTMLInputElement;
        if (nameInput) nameInput.value = '';
        if (valueInput) valueInput.value = '';
      } else if (type === 'set') {
        const valueSelect = document.getElementById('set-value') as HTMLSelectElement;
        if (valueSelect) valueSelect.value = '';
      } else if (type === 'table') {
        const nameInput = document.getElementById('table-name') as HTMLInputElement;
        const entriesInput = document.getElementById('table-entries') as HTMLInputElement;
        if (nameInput) nameInput.value = '';
        if (entriesInput) entriesInput.value = '';
      } else if (type === 'rule') {
        // Clear rule form inputs
        const inputs = [
          'rule-action',
          'rule-direction',
          'rule-proto',
          'rule-state',
          'rule-interface',
          'rule-from',
          'rule-to',
          'rule-port',
          'rule-redirect',
          'rule-options',
        ];
        inputs.forEach((id) => {
          const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
          if (input) input.value = '';
        });
      } else if (type === 'anchor') {
        const nameInput = document.getElementById('anchor-name') as HTMLInputElement;
        if (nameInput) nameInput.value = '';
      }
    }
  };

  // Handle dropping new items into existing sections
  const handleDropNewItem = (e: React.DragEvent, targetType: string, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    logger.debug('Processing dropped item', { targetType, targetIndex });

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

      // Only handle drops from new items
      if (!dragData.isNew) {
        return;
      }

      const { item, index: newItemIndex } = dragData;

      // Remove the item from newFilters
      setNewFilters((prev) => prev.filter((_, i) => i !== newItemIndex));

      // Add the item to packetFilters at the specified position
      if (packetFilters?.items) {
        const updatedItems = [...packetFilters.items];

        // Determine desired line based on the ACTUAL item type, not the drop zone type
        // This ensures items go to their correct type section with proper line numbering
        const itemType = item.type; // The actual type of the item being dropped
        const typeItems = updatedItems
          .filter((i) => i.type === itemType)
          .sort((a, b) => a.line - b.line);
        let desiredLine: number;

        if (typeItems.length === 0) {
          // No items of this type exist yet - use ordering logic to find correct position
          desiredLine = getCorrectPositionForNewItem(itemType, updatedItems);
        } else if (targetIndex === undefined || targetIndex >= typeItems.length) {
          // End of this type section → after last line of this type
          desiredLine = typeItems[typeItems.length - 1].line + 1;
        } else if (targetIndex <= 0) {
          // Insert at the very start of this type section
          desiredLine = typeItems[0].line;
        } else {
          // Insert between two items of this type
          desiredLine = typeItems[targetIndex - 1].line + 1;
        }

        // Shift all items at or after desired line by +1 to prevent duplicates
        const shifted = updatedItems.map((it) =>
          it.line >= desiredLine ? { ...it, line: it.line + 1 } : it
        );

        // Add new item with the desired line number
        const newItem = formatItemForPayload(item, desiredLine);
        if (newItem) {
          newItem.status = 'new';
          shifted.push(newItem);
        }

        // Sort by line to keep order consistent
        shifted.sort((a, b) => a.line - b.line);

        setPacketFilters((prev) => ({
          ...prev,
          items: shifted,
        }));

        // Mark that we have changes to save
        setHasChanges(true);

        // Auto-scroll to the target section after the drop
        setTimeout(() => {
          const leftSideContainer = document.querySelector('.left-side-container') as HTMLElement;

          if (leftSideContainer) {
            // IMPORTANT: We need to scroll to the section where the item was ACTUALLY placed
            // This might be different from the targetType if the item type doesn't match the drop zone
            const itemType = item.type; // The actual type of the item being dropped

            // Find the section where the item was actually placed (based on item type, not drop zone)
            const actualSection = leftSideContainer.querySelector(`[data-type="${itemType}"]`);

            if (actualSection) {
              // Find the newly added item within this section to scroll to it specifically
              const newItem = actualSection.querySelector('[data-status="new"]');
              if (newItem) {
                logger.info('🎯 Found newly added item, scrolling to it...');
                newItem.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'nearest',
                });
              } else {
                logger.info('🚀 No new item found, scrolling to section header...');
                actualSection.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                  inline: 'nearest',
                });
              }
              logger.info('Scroll command executed to actual section');
            } else {
              logger.info(
                'Actual section not found. Available data-types:',
                Array.from(leftSideContainer.querySelectorAll('[data-type]')).map((el) =>
                  el.getAttribute('data-type')
                )
              );
            }
          } else {
            logger.info('Left side container not found');
          }
        }, 100); // Small delay to ensure state update is complete

        logger.info('Item successfully added to packetFilters');
      }
    } catch (error) {
      logger.error('Failed to handle item drop', { targetType, error });
    }
  };

  // Handle drag over for drop zones
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper function to validate drag operations and provide visual feedback
  const handleDragEnter = (e: React.DragEvent, targetType: string) => {
    e.preventDefault();

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const isSameType = dragData.type === targetType;

      if (isSameType) {
        // Valid drop - show blue highlight
        e.currentTarget.classList.add(
          'h-4',
          'bg-blue-100',
          'border-2',
          'border-blue-400',
          'border-dashed'
        );
        e.currentTarget.querySelector('.drop-indicator')?.classList.remove('opacity-0');
      } else {
        // Invalid drop - show red highlight
        e.currentTarget.classList.add(
          'h-4',
          'bg-red-100',
          'border-2',
          'border-red-400',
          'border-dashed'
        );
        e.currentTarget.querySelector('.drop-indicator')?.classList.remove('opacity-0');
        e.currentTarget.querySelector('.drop-indicator span')?.classList.add('text-red-600');
      }
    } catch (error) {
      // If we can't parse drag data, assume it's a new item (which is always valid)
      e.currentTarget.classList.add(
        'h-4',
        'bg-blue-100',
        'border-2',
        'border-blue-400',
        'border-dashed'
      );
      e.currentTarget.querySelector('.drop-indicator')?.classList.remove('opacity-0');
    }
  };

  // Helper function to handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove(
      'h-4',
      'bg-blue-100',
      'bg-red-100',
      'border-2',
      'border-blue-400',
      'border-red-400',
      'border-dashed'
    );
    e.currentTarget.querySelector('.drop-indicator')?.classList.add('opacity-0');
    e.currentTarget.querySelector('.drop-indicator span')?.classList.remove('text-red-600');
  };

  // Helper function to substitute variables in rule content
  const substituteVariables = (value: string): string => {
    if (!value || typeof value !== 'string') return value;

    // Check if this value is a defined variable
    const availableVariables = getAvailableVariables();
    const matchingVariable = availableVariables.find((v) => v.value === value);

    // If it's a defined variable, use $ prefix, otherwise return as-is
    return matchingVariable ? `$${matchingVariable.name}` : value;
  };

  // Format item for payload according to the required structure
  const formatItemForPayload = (item: any, lineNumber: number) => {
    // Exclude status fields and extra fields from the payload
    const {
      status,
      prevRaw,
      prevContent,
      toggle_type,
      isTemplateGenerated,
      isNewlyAdded,
      ...itemWithoutStatus
    } = item;

    // Don't format deleted items
    if (status === 'deleted') {
      return null;
    }

    const formattedItem = {
      ...itemWithoutStatus,
      line: lineNumber,
    };

    // Format content based on item type to match the expected payload structure
    if (item.type === 'variable') {
      // Extract variable name and value from raw content
      const varMatch = item.raw.match(/^(\w+)="([^"]*)"$/);
      if (varMatch) {
        formattedItem.content = { [varMatch[1]]: varMatch[2] };
      }
    } else if (item.type === 'set') {
      // Format set content properly
      formattedItem.content = {
        set: 'set',
        gop_key: item.content?.gop_key || item.raw.split(' ')[1],
        gop_value: item.content?.gop_value || item.raw.split(' ').slice(2).join(' '),
      };
    } else if (item.type === 'table') {
      // Format table content
      formattedItem.content = {
        name: item.content?.name || item.raw.match(/<([^>]+)>/)?.[1] || '',
        properties: item.content?.properties || [],
        entries: item.content?.entries || [],
      };
    } else if (item.type === 'rule') {
      // Format rule content with all required fields including address_family and options
      formattedItem.content = {
        action: item.content?.action || item.raw.split(' ')[0] || 'pass',
        direction: item.content?.direction || '',
        interface: substituteVariables(item.content?.interface || ''),
        address_family: item.content?.address_family || item.content?.addressFamily || '',
        proto: item.content?.proto || '',
        from: substituteVariables(item.content?.from || ''),
        to: substituteVariables(item.content?.to || ''),
        ports: item.content?.port
          ? typeof item.content.port === 'string' && item.content.port.includes(',')
            ? item.content.port
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p)
            : [item.content.port]
          : item.content?.ports || [],
        log: item.content?.log || false,
        quick: item.content?.quick || false,
        state: item.content?.state || '',
        options: item.content?.options || '',
        redirect: item.content?.redirect
          ? item.content.redirect.trim().startsWith('->')
            ? item.content.redirect.trim()
            : `-> ${item.content.redirect.trim()}`
          : '',
        pass: item.content?.pass || false,
        is_toggle: item.content?.is_toggle || false,
        toggle_names: item.content?.toggle_names || [],
        toggle_states: item.content?.toggle_states || [],
      };
    } else if (item.type === 'anchor') {
      // Format anchor content
      formattedItem.content = {
        type: item.content?.type || item.raw.split(' ')[0] || 'nat-anchor',
        name: item.content?.name || item.raw.match(/"([^"]+)"/)?.[1] || '',
        options: item.content?.options || '',
      };
    } else if (item.type === 'anchor_template') {
      // Format anchor_template content - handle deletion by flipping boolean and updating raw
      const originalContent = item.content;
      let updatedContent = { ...originalContent };

      // If this item was marked as deleted, flip the boolean and update raw content
      if (item.status === 'deleted') {
        logger.info('🔄 Processing deleted anchor_template in formatItems:', {
          original: originalContent,
          line: item.line,
        });

        // Validate that we have the required file paths
        if (!updatedContent.enabled_file_path || !updatedContent.disabled_file_path) {
          logger.error('Missing file paths for anchor_template in formatItems', {
            content: updatedContent,
          });
          // Fall back to original content if paths are missing
          updatedContent = { ...originalContent };
        } else {
          // Flip the is_enabled boolean
          updatedContent.is_enabled = !originalContent.is_enabled;

          logger.info('✅ Updated anchor_template content in formatItems:', {
            flipped: updatedContent.is_enabled,
            enabledPath: updatedContent.enabled_file_path,
            disabledPath: updatedContent.disabled_file_path,
          });
        }
      }

      // Remove raw field from content object
      const { raw: _raw, ...contentWithoutRaw } = updatedContent;
      formattedItem.content = contentWithoutRaw;

      // Update the raw field directly on the formattedItem (not in content)
      if (
        item.status === 'deleted' &&
        updatedContent.enabled_file_path &&
        updatedContent.disabled_file_path
      ) {
        if (updatedContent.is_enabled) {
          // Use enabled file path
          formattedItem.raw = `include "${updatedContent.enabled_file_path}"`;
        } else {
          // Use disabled file path
          formattedItem.raw = `include "${updatedContent.disabled_file_path}"`;
        }

        logger.info('Updated anchor_template raw in formatItems:', {
          newRaw: formattedItem.raw,
        });
      }
    }

    return formattedItem;
  };

  // Construct debug payload to show exactly what will be sent
  const constructDebugPayload = () => {
    if (isSimpleMode && packetFilters) {
      // In simple mode, construct the complete payload
      // Filter out deleted items (except anchor_template which should be processed)
      const activeItems = packetFilters.items.filter(
        (item) => item.status !== 'deleted' || item.type === 'anchor_template'
      );
      const formattedItems = activeItems.map((item: any, index: number) => {
        // Exclude status fields and extra fields from the payload
        const {
          status,
          prevRaw,
          prevContent,
          toggle_type,
          isTemplateGenerated,
          isNewlyAdded,
          ...itemWithoutStatus
        } = item;
        const updatedItem = {
          ...itemWithoutStatus,
          line: index + 1,
        };

        // Format content based on item type
        if (item.type === 'variable') {
          // Extract variable name and value from raw content
          const varMatch = item.raw.match(/^(\w+)="([^"]*)"$/);
          if (varMatch) {
            updatedItem.content = { [varMatch[1]]: varMatch[2] };
          }
        } else if (item.type === 'set') {
          // Format set content properly
          updatedItem.content = {
            set: 'set',
            gop_key: item.content?.gop_key || item.raw.split(' ')[1],
            gop_value: item.content?.gop_value || item.raw.split(' ').slice(2).join(' '),
          };
        } else if (item.type === 'table') {
          // Format table content
          updatedItem.content = {
            name: item.content?.name || item.raw.match(/<([^>]+)>/)?.[1] || '',
            properties: item.content?.properties || [],
            entries: item.content?.entries || [],
          };
        } else if (item.type === 'rule') {
          // Format rule content with all required fields including address_family and options
          updatedItem.content = {
            action: item.content?.action || item.raw.split(' ')[0] || 'pass',
            direction: item.content?.direction || '',
            interface: substituteVariables(item.content?.interface || ''),
            address_family: item.content?.address_family || item.content?.addressFamily || '',
            proto: item.content?.proto || '',
            from: substituteVariables(item.content?.from || ''),
            to: substituteVariables(item.content?.to || ''),
            ports: item.content?.port
              ? typeof item.content.port === 'string' && item.content.port.includes(',')
                ? item.content.port
                    .split(',')
                    .map((p) => p.trim())
                    .filter((p) => p)
                : [item.content.port]
              : item.content?.ports || [],
            log: item.content?.log || false,
            quick: item.content?.quick || false,
            state: item.content?.state || '',
            options: item.content?.options || '',
            redirect: item.content?.redirect
              ? item.content.redirect.trim().startsWith('->')
                ? item.content.redirect.trim()
                : `-> ${item.content.redirect.trim()}`
              : '',
            pass: item.content?.pass || false,
            is_toggle: item.content?.is_toggle || false,
            toggle_names: item.content?.toggle_names || [],
            toggle_states: item.content?.toggle_states || [],
          };
        } else if (item.type === 'anchor') {
          // Format anchor content
          updatedItem.content = {
            type: item.content?.type || item.raw.split(' ')[0] || 'nat-anchor',
            name: item.content?.name || item.raw.match(/"([^"]+)"/)?.[1] || '',
            options: item.content?.options || '',
          };
        } else if (item.type === 'anchor_template') {
          // For anchor_template, handle deletion by flipping the boolean and updating raw content
          const originalContent = item.content;
          let updatedContent = { ...originalContent };

          // If this item was marked as deleted, flip the boolean and update raw content
          if (item.status === 'deleted') {
            logger.info('🔄 Processing deleted anchor_template:', {
              original: originalContent,
              line: item.line,
            });

            // Validate that we have the required file paths
            if (!updatedContent.enabled_file_path || !updatedContent.disabled_file_path) {
              logger.error('Missing file paths for anchor_template', { content: updatedContent });
              // Fall back to original content if paths are missing
              updatedContent = { ...originalContent };
            } else {
              // Flip the is_enabled boolean
              updatedContent.is_enabled = !originalContent.is_enabled;

              logger.info('✅ Updated anchor_template content:', {
                flipped: updatedContent.is_enabled,
                enabledPath: updatedContent.enabled_file_path,
                disabledPath: updatedContent.disabled_file_path,
              });
            }
          }

          // Remove raw field from content object
          const { raw: _raw, ...contentWithoutRaw } = updatedContent;
          updatedItem.content = contentWithoutRaw;

          // Update the raw field directly on the item (not in content)
          if (
            item.status === 'deleted' &&
            updatedContent.enabled_file_path &&
            updatedContent.disabled_file_path
          ) {
            if (updatedContent.is_enabled) {
              // Use enabled file path
              updatedItem.raw = `include "${updatedContent.enabled_file_path}"`;
            } else {
              // Use disabled file path
              updatedItem.raw = `include "${updatedContent.disabled_file_path}"`;
            }

            logger.info('Updated anchor_template raw:', {
              newRaw: updatedItem.raw,
            });
          }
        }

        return updatedItem;
      });

      // Return as object with items array to match PFConfigPayload
      return { items: formattedItems };
    } else {
      // In advanced mode, return the raw rules
      return {
        raw_rules: localRules,
        mode: 'advanced',
      };
    }
  };

  // Generate raw content for new filters
  const generateRawContent = (type: string, formData: any): string => {
    switch (type) {
      case 'variable': {
        const varName = Object.keys(formData)[0];
        const varValue = Object.values(formData)[0];
        return `${varName}="${varValue}"`;
      }
      case 'set': {
        return `set ${formData.gop_key} ${formData.gop_value}`;
      }
      case 'table': {
        const properties = formData.properties ? ` ${formData.properties.join(' ')}` : '';
        const entries = formData.entries ? ` { ${formData.entries.join(', ')} }` : '';
        return `table <${formData.name}>${properties}${entries}`;
      }
      case 'rule': {
        // If this is a template-generated rule, use the raw template
        if (formData.isTemplateGenerated && formData.raw) {
          return formData.raw;
        }

        // Generate rule following CORRECT PF syntax order
        const {
          action,
          direction,
          options,
          interface: iface,
          address_family,
          proto,
          from,
          to,
          port,
          state,
          redirect,
        } = formData;
        let rule = `${action}`;

        // Step 1: Action is already added

        // Step 2: Early options (log, quick, and pass for rdr/nat) - right after action
        const earlyOptions = [];

        // Add boolean options from formData
        if (formData.quick === true) {
          earlyOptions.push('quick');
        }
        if (formData.log === true) {
          earlyOptions.push('log');
        }
        if (action === 'rdr' && formData.pass === true) {
          earlyOptions.push('pass');
        }

        if (earlyOptions.length > 0) {
          rule += ` ${earlyOptions.join(' ')}`;
        }

        // Step 3: Direction - after action/early options
        if (direction && direction !== '') rule += ` ${direction}`;

        // Step 4 & 5: Order depends on action type
        if (action === 'nat') {
          // NAT rules: Interface comes before Address Family
          if (iface && iface !== '') {
            rule += ` on ${iface}`;
          }
          if (address_family && address_family !== '') rule += ` ${address_family}`;
        } else if (action === 'antispoof') {
          // Antispoof rules: Interface comes before Address Family
          if (iface && iface !== '') {
            rule += ` for ${iface}`; // antispoof: use "for" keyword
          }
          if (address_family && address_family !== '') rule += ` ${address_family}`;
        } else {
          // All other rules: Address Family comes before Interface
          if (address_family && address_family !== '') rule += ` ${address_family}`;
          if (iface && iface !== '') {
            rule += ` on ${iface}`; // other actions: use "on" keyword
          }
        }

        // Step 6: Protocol - after interface/address family (order depends on action)
        if (proto && proto !== '') rule += ` proto ${proto}`;

        // Step 7: Source and destination - after protocol
        if (from && from !== '') rule += ` from ${from}`;
        if (to && to !== '') rule += ` to ${to}`;

        // Step 8: Port - after from/to
        if (port && port !== '') {
          const portStr = port.toString();
          if (portStr.includes(',')) {
            rule += ` port {${portStr}}`;
          } else {
            rule += ` port ${portStr}`;
          }
        }

        // Step 9: State - after port
        if (state && state !== '') rule += ` ${state} state`;

        // Step 9.5: Redirect - for NAT and RDR rules, comes after state
        if (redirect && redirect !== '' && (action === 'nat' || action === 'rdr')) {
          rule += ` -> ${redirect}`;
        }

        // Step 10: Remaining options (everything except early options) - LAST
        if (options) {
          const optionParts = options.split(/\s+/).filter(Boolean);
          const lateOptions = optionParts.filter((opt) => {
            // Filter out early options
            if (opt === 'log' || opt === 'quick') return false;
            if (opt === 'pass' && (action === 'rdr' || action === 'nat')) return false;
            return true;
          });
          if (lateOptions.length > 0) {
            rule += ` ${lateOptions.join(' ')}`;
          }
        }

        return rule;
      }
      case 'anchor': {
        return `${formData.type} "${formData.name}"`;
      }
      case 'anchor_template': {
        // For anchor_template, return the raw template content as-is
        return formData.raw || '';
      }
      default:
        return '';
    }
  };

  // Handle revert countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (firewall.revertEndTime) {
      // reset refresh guard when a new countdown starts
      hasRefreshedOnExpiryRef.current = false;
      // Calculate remaining time based on end time
      const updateCountdown = () => {
        const now = Date.now();
        const remainingMs = firewall.revertEndTime - now;
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

        if (remainingSeconds > 0) {
          // Only update if the value actually changed to avoid unnecessary re-renders
          if (firewall.revertCountdown !== remainingSeconds) {
            setFirewallRevertCountdown(remainingSeconds);
          }
        } else {
          // Countdown has expired, revert changes
          setFirewallRevertCountdown(null);
          setHasChanges(false);
          setValidationError(null);

          // Reset all item statuses when reverting
          if (isSimpleMode && packetFilters) {
            setPacketFilters((prev) => ({
              ...prev,
              items: prev.items.map((item) => ({
                ...item,
                status: undefined, // Reset status to undefined (unchanged)
              })),
            }));
          }

          // Clear new filters when reverting
          setNewFilters([]);

          // Clear deleted items tracking when reverting
          clearDeletedItems();

          // Refresh data from server to show the actual reverted rules
          if (!hasRefreshedOnExpiryRef.current && (selectedServer?.fqdn || selectedServer?.ip)) {
            hasRefreshedOnExpiryRef.current = true;
            // Add a small delay to allow server to complete the revert operation
            setTimeout(() => {
              if (isSimpleMode) {
                // Refresh simple mode data, then also refresh advanced text rules for consistency
                Promise.resolve(fetchPacketFilters()).finally(() => {
                  fetchFirewallRules(selectedServer?.fqdn || selectedServer.ip).then(
                    (rules: string) => {
                      setLocalRules(rules || '');
                    }
                  );
                });
              } else {
                fetchFirewallRules(selectedServer?.fqdn || selectedServer.ip).then(
                  (rules: string) => {
                    setLocalRules(rules || '');
                  }
                );
              }
            }, 1000); // Wait 1 second for server to complete revert
          }

          setFirewallNotification({ message: 'Changes reverted automatically.', type: 'info' });
          // stop further interval ticks once handled
          if (interval) {
            clearInterval(interval);
          }
        }
      };

      // Update immediately when component mounts
      updateCountdown();

      // Set up interval to update every second
      interval = setInterval(updateCountdown, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    firewall.revertEndTime,
    selectedServer?.fqdn,
    selectedServer?.ip,
    isSimpleMode,
    packetFilters,
  ]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localRules);
      setFirewallNotification({ message: 'Copied!', type: 'success' });
      setTimeout(() => setFirewallNotification(null), 2000);
    } catch {
      setFirewallNotification({ message: 'Failed to copy to clipboard.', type: 'error' });
    }
  };

  // Function to parse error message and extract all line numbers
  const parseErrorMessage = (errorMsg: string): number[] | null => {
    // Extract all line numbers from error messages with various formats
    // This handles formats like:
    // - "pf.conf.new:12: syntax error"
    // - "line 12: unknown protocol"
    // - "error on line 12"
    // - "at line 12"
    const lineMatches = errorMsg.matchAll(
      /(?:pf\.conf\.new:|line\s+|on\s+line\s+|at\s+line\s+)(\d+)(?::|,|\s|\b)/g
    );
    const lineNumbers = [];

    if (lineMatches) {
      for (const match of lineMatches) {
        if (match && match[1]) {
          lineNumbers.push(parseInt(match[1], 10));
        }
      }
    }

    // If we couldn't find any line numbers but we have an error message,
    // mark the first line as having an error (as a fallback)
    if (lineNumbers.length === 0 && errorMsg && errorMsg.trim().length > 0) {
      lineNumbers.push(1); // Mark the first line as a fallback
    }

    return lineNumbers.length > 0 ? lineNumbers : null;
  };

  // Function to add error markers to the editor
  const addErrorMarkers = (lineNumbers: number[], errorMessage: string): void => {
    if (!editorRef.current || !monacoRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // Extract error details to provide more specific highlighting
    const { syntaxError, portIssue } = extractErrorDetails(errorMessage);

    // Create markers for each error line
    const markers = lineNumbers.map((lineNumber) => {
      const lineContent = model.getLineContent(lineNumber);
      let startColumn = 1;
      let endColumn = model.getLineMaxColumn(lineNumber);

      // Try to find the problematic text in the line for more precise highlighting
      if (syntaxError && lineContent.includes(syntaxError)) {
        startColumn = lineContent.indexOf(syntaxError) + 1;
        endColumn = startColumn + syntaxError.length;
      } else if (portIssue && lineContent.includes(portIssue)) {
        startColumn = lineContent.indexOf(portIssue) + 1;
        endColumn = startColumn + portIssue.length;
      } else if (lineContent.includes('port')) {
        // Find the port section if it exists
        const portMatch = lineContent.match(/port\s+([^\s]+)/);
        if (portMatch && portMatch.index) {
          startColumn = portMatch.index + 1;
          endColumn = startColumn + portMatch[0].length;
        }
      }

      return {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn,
        endColumn,
        message: errorMessage,
        severity: monacoRef.current!.MarkerSeverity.Error,
      };
    });

    // Set the markers on the model
    monacoRef.current.editor.setModelMarkers(model, 'firewall-validation', markers);
  };

  // Generate rule preview before saving
  const generateRulePreview = async () => {
    if (!isSimpleMode && !localRules.trim()) {
      setFirewallNotification({
        message: 'No rules to preview.',
        type: 'info',
      });
      return;
    }

    setIsPreviewGenerating(true);
    try {
      const payload = constructDebugPayload();
      const rulesText = await generateFirewallRules(
        selectedServer?.fqdn || selectedServer.ip,
        payload,
        dispatch
      );
      setPreviewRules(rulesText);
      setEditedRules(rulesText);
      setRulePreviewModalOpen(true);
    } catch (err: any) {
      logger.error('Failed to generate rule preview', {
        serverIp: selectedServer?.fqdn || selectedServer.ip,
        error: err,
      });
      setFirewallNotification({
        message: err?.message || 'Failed to generate rule preview',
        type: 'error',
      });
    } finally {
      setIsPreviewGenerating(false);
    }
  };

  // Save rules
  const handleSave = async () => {
    setFirewallNotification(null);

    // Clear any existing markers
    if (editorRef.current && editorRef.current.getModel() && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'firewall-validation', []);
      }
    }

    // Only make API call if rules have changed
    if (!hasChanges) {
      setFirewallNotification({
        message: 'No changes to save.',
        type: 'info',
      });
      return;
    }

    // In simple mode, show rule preview first
    if (isSimpleMode) {
      await generateRulePreview();
    } else {
      // In advanced mode, save directly without preview
      await proceedWithSaveDirect();
    }
  };

  // Proceed with actual save after preview
  const proceedWithSave = async (approver?: string) => {
    setRulePreviewModalOpen(false);
    setFirewallNotification(null);

    // Use the edited rules instead of the original payload
    const rulesToApply = editedRules.trim();

    // Validate that we have rules to apply
    if (!rulesToApply) {
      setFirewallNotification({
        message: 'No rules to apply. Please generate rules first or edit the rules.',
        type: 'error',
      });
      return;
    }

    // // Validate the edited rules
    // const validation = validateRules(rulesToApply);
    // if (!validation.valid) {
    //   setFirewallNotification({
    //     message: validation.message,
    //     type: "error"
    //   });
    //   return;
    // }

    const performUpdate = async (approver?: string) => {
      try {
        logger.info('DEBUG: Updating firewall rules with approver:', approver);

        // Use the edited rules directly for both simple and advanced modes
        const payload = rulesToApply;

        const result = await updateFirewallRulesAPI(
          selectedServer?.fqdn || selectedServer.ip,
          payload,
          dispatch,
          approver,
          isSimpleMode
        );
        if (result?.error) {
          setFirewallNotification({ message: result.error, type: 'error' });

          // Parse the error message to highlight all problematic lines
          const errorLineNumbers = parseErrorMessage(result.error);
          if (errorLineNumbers && errorLineNumbers.length > 0) {
            addErrorMarkers(errorLineNumbers, result.error);
          }
        } else {
          setFirewallId(result.id);
          setHasChanges(false);

          // Reset all item statuses after successful save
          if (isSimpleMode && packetFilters) {
            setPacketFilters((prev) => ({
              ...prev,
              items: prev.items.map((item) => ({
                ...item,
                status: undefined, // Reset status to undefined (unchanged)
              })),
            }));
          }

          // Clear new filters after successful save
          setNewFilters([]);

          // Clear deleted items tracking after successful save
          clearDeletedItems();

          // Show success notification
          setFirewallNotification({
            message: 'Firewall rules updated successfully!',
            type: 'success',
          });

          // Refresh the packet filters to get updated data
          if (isSimpleMode) {
            await fetchPacketFilters();

            // Also update the advanced mode rules to reflect the changes
            const updatedRules = await fetchFirewallRules(
              selectedServer?.fqdn || selectedServer.ip
            );
            setLocalRules(updatedRules || '');
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An error occurred while updating firewall rules.';
        setFirewallNotification({
          message: errorMessage,
          type: 'error',
        });
      }
    };

    // Use approval flow if user requires approval
    if (requiresApproval) {
      logger.info('DEBUG: Firewall rules update requires approval');
      await executeWithApproval(performUpdate, 'Update Firewall Rules');
    } else {
      logger.info('DEBUG: Firewall rules update does not require approval');
      await executeWithApproval(performUpdate, 'Update Firewall Rules');
    }
  };

  // Direct save for advanced mode (without preview modal)
  const proceedWithSaveDirect = async (approver?: string) => {
    setFirewallNotification(null);

    // Use the local rules directly for advanced mode
    const rulesToApply = localRules.trim();

    // Validate that we have rules to apply
    if (!rulesToApply) {
      setFirewallNotification({
        message: 'No rules to apply. Please enter some rules first.',
        type: 'error',
      });
      return;
    }

    // Validate the rules
    // const validation = validateRules(rulesToApply);
    // if (!validation.valid) {
    //   setFirewallNotification({
    //     message: validation.message,
    //     type: "error"
    //   });
    //   return;
    // }

    const performUpdate = async (approver?: string) => {
      try {
        logger.info('DEBUG: Direct updating firewall rules with approver:', approver);

        // Use the local rules directly
        const payload = rulesToApply;

        const result = await updateFirewallRulesAPI(
          selectedServer?.fqdn || selectedServer.ip,
          payload,
          dispatch,
          approver,
          isSimpleMode
        );
        if (result?.error) {
          setFirewallNotification({ message: result.error, type: 'error' });

          // Parse the error message to highlight all problematic lines
          const errorLineNumbers = parseErrorMessage(result.error);
          if (errorLineNumbers && errorLineNumbers.length > 0) {
            addErrorMarkers(errorLineNumbers, result.error);
          }
        } else {
          setFirewallId(result.id);
          setHasChanges(false);

          // Start countdown timer for confirmation (same as advanced mode)
          const countdownSeconds = 59;
          const endTime = Date.now() + countdownSeconds * 1000;

          // Update firewall state with countdown (similar to UPDATE_FIREWALL_RULES_SUCCESS)
          dispatch({
            type: ActionTypes.UPDATE_FIREWALL_RULES_SUCCESS,
            payload: {
              serverIp: selectedServer?.fqdn || selectedServer.ip,
              id: result.id,
              rules: payload,
              revertCountdown: countdownSeconds,
              revertEndTime: endTime,
            },
          });

          // Clear new filters after successful save
          setNewFilters([]);

          // Clear deleted items tracking after successful save
          clearDeletedItems();

          // Show success notification
          setFirewallNotification({
            message:
              'Firewall rules updated successfully! You have 59 seconds to confirm or revert changes.',
            type: 'success',
          });

          // Refresh packet filters if in simple mode to keep them in sync
          if (isSimpleMode) {
            await fetchPacketFilters();
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An error occurred while updating firewall rules.';
      }
    };

    // Use approval flow if user requires approval
    if (requiresApproval) {
      logger.info('DEBUG: Firewall rules update requires approval');
      await executeWithApproval(performUpdate, 'Update Firewall Rules');
    } else {
      logger.info('DEBUG: Firewall rules update does not require approval');
      await executeWithApproval(performUpdate, 'Update Firewall Rules');
    }
  };

  // Cancel revert
  const handleCancelRevert = async () => {
    if (!firewall.id) return;
    const result = await cancelFirewallRevert(
      selectedServer?.fqdn || selectedServer.ip,
      firewall.id
    );
    if (result?.success) {
      setFirewallRevertCountdown(null);
      setFirewallNotification({ message: 'Changes confirmed successfully.', type: 'success' });
    } else if (result?.error) {
      setFirewallNotification({ message: result.error, type: 'error' });
    }
  };

  // Cancel edits
  const handleCancel = () => {
    if (!hasChanges) {
      setFirewallNotification({ message: 'No changes to cancel.', type: 'info' });
      return;
    }

    setFirewallNotification(null);
    if (editorRef.current && editorRef.current.getModel() && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // Clear all markers
        monacoRef.current.editor.setModelMarkers(model, 'owner', []);
        monacoRef.current.editor.setModelMarkers(model, 'firewall-validation', []);
      }
    }

    // Reset to original rules
    setLocalRules(firewall.originalRules);
    setHasChanges(false);
    setValidationError(null);

    // Reset all item statuses when canceling
    if (isSimpleMode && packetFilters) {
      setPacketFilters((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({
          ...item,
          status: undefined, // Reset status to undefined (unchanged)
        })),
      }));
    }

    // Clear new filters when canceling
    setNewFilters([]);

    // Clear deleted items tracking when canceling
    clearDeletedItems();
  };

  // Handle local rule changes
  const handleRuleChange = (value: string | undefined): void => {
    const newValue = value || '';
    setLocalRules(newValue);
    setHasChanges(newValue !== firewall.originalRules);
    // Don't show validation errors while typing
    setValidationError(null);

    // Clear error markers when user modifies text
    if (editorRef.current && editorRef.current.getModel() && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // Clear all markers when text is edited
        monacoRef.current.editor.setModelMarkers(model, 'firewall-validation', []);
      }
    }
  };

  // Helper function to get border styling based on item status
  const getItemBorderStyle = (item: any) => {
    if (!item.status) return 'border-gray-200'; // Default for unchanged items
    switch (item.status) {
      case 'new':
        return 'border-green-400 bg-green-50'; // Green for new items
      case 'edited':
        return 'border-orange-400 bg-orange-50'; // Orange for edited items
      case 'deleted':
        return 'border-red-300 bg-red-50'; // Red for deleted items
      default:
        return 'border-gray-200'; // Default for unchanged items
    }
  };

  // Helper function to get status indicator text
  const getStatusIndicator = (item: any) => {
    const indicators = [];

    // Add edit status indicator
    if (item.status) {
      switch (item.status) {
        case 'new':
          indicators.push(
            <span key="status" className="text-green-600 text-xs font-medium">
              (NEW)
            </span>
          );
          break;
        case 'edited':
          indicators.push(
            <span key="status" className="text-orange-600 text-xs font-medium">
              (EDITED)
            </span>
          );
          break;
        case 'deleted':
          indicators.push(
            <span key="status" className="text-red-600 text-xs font-medium">
              (DELETED)
            </span>
          );
          break;
      }
    }

    // Add toggle status indicator for toggle rules
    if (item.content?.is_toggle && item.content?.toggle_status) {
      const toggleStatus = item.content.toggle_status === 'enabled';
      indicators.push(
        <span
          key="toggle"
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            toggleStatus ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {toggleStatus ? 'ENABLED' : 'DISABLED'}
        </span>
      );
    }

    return indicators.length > 0 ? <div className="flex gap-1">{indicators}</div> : null;
  };

  // Function to recalculate line numbers for all items
  const recalculateLineNumbers = (items: any[]) => {
    return items.map((item, index) => ({
      ...item,
      line: index + 1,
    }));
  };

  // Function to check if a type section has deleted items
  const hasDeletedItems = (type: string) => {
    return (
      packetFilters?.items?.some((item) => item.type === type && item.status === 'deleted') || false
    );
  };

  // Function to get the count of deleted items for a specific type
  const getDeletedItemsCount = (type: string) => {
    return (
      packetFilters?.items?.filter((item) => item.type === type && item.status === 'deleted')
        .length || 0
    );
  };

  // Function to get the count of toggle rules
  const getToggleRulesCount = () => {
    return (
      packetFilters?.items?.filter((item) => item.type === 'rule' && item.content?.is_toggle)
        .length || 0
    );
  };

  // Function to validate IP addresses
  const validateIPAddresses = (entries: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!entries.trim()) {
      return { isValid: true, errors: [] }; // Empty is valid
    }

    const ipList = entries
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    if (ipList.length === 0) {
      return { isValid: true, errors: [] }; // Only whitespace is valid
    }

    ipList.forEach((ip, index) => {
      // Check for CIDR notation (e.g., 192.168.1.0/24)
      if (ip.includes('/')) {
        const [address, prefix] = ip.split('/');
        const prefixNum = parseInt(prefix);

        if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
          errors.push(
            `Invalid CIDR prefix at position ${index + 1}: "${ip}" - prefix must be 0-32`
          );
        }

        if (!isValidIPAddress(address)) {
          errors.push(`Invalid IP address in CIDR at position ${index + 1}: "${ip}"`);
        }
      } else {
        // Regular IP address
        if (!isValidIPAddress(ip)) {
          errors.push(`Invalid IP address at position ${index + 1}: "${ip}"`);
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  // Function to validate individual IP address
  const isValidIPAddress = (ip: string): boolean => {
    // IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every((part) => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
      });
    }

    // IPv6 validation (basic)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Regex.test(ip)) {
      return true;
    }

    // IPv6 with :: notation
    const ipv6CompressedRegex = /^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*$/;
    if (ipv6CompressedRegex.test(ip)) {
      return true;
    }

    // Check for special values
    if (['any', 'self', 'localhost'].includes(ip.toLowerCase())) {
      return true;
    }

    return false;
  };

  // Function to get available variables for dropdowns
  const getAvailableVariables = () => {
    if (!packetFilters?.items) return [];

    return packetFilters.items
      .filter((item: any) => item.type === 'variable')
      .map((item: any) => {
        const varName = Object.keys(item.content)[0];
        const varValue = Object.values(item.content)[0];
        return {
          name: varName,
          value: varValue,
          display: `${varName} (${varValue})`,
        };
      });
  };

  // Function to get interface options (combining system interfaces and variables)
  const getInterfaceOptions = () => {
    const systemInterfaces = interfaces.map((iface) => ({
      name: iface,
      value: iface,
      display: `${iface} (system)`,
      type: 'system',
    }));

    const variableInterfaces = getAvailableVariables().map((variable) => ({
      name: variable.name,
      value: `$${variable.name}`,
      display: `${variable.name} (${variable.value})`,
      type: 'variable',
    }));

    return [...systemInterfaces, ...variableInterfaces];
  };

  // Function to get source/destination options (combining common values and variables)
  const getSourceDestOptions = () => {
    const commonOptions = [
      { name: 'any', value: 'any', display: 'any', type: 'common' },
      { name: 'self', value: 'self', display: 'self', type: 'common' },
      { name: 'localhost', value: 'localhost', display: 'localhost', type: 'common' },
    ];

    const variableOptions = getAvailableVariables()
      .filter((variable) => {
        // Filter variables that look like IP addresses or networks
        const varValue = variable.value as string;
        return (
          isValidIPAddress(varValue) ||
          varValue.includes('/') ||
          /^(10\.|172\.|192\.168\.|127\.)/.test(varValue)
        );
      })
      .map((variable) => ({
        name: variable.name,
        value: `$${variable.name}`,
        display: `${variable.name} (${variable.value})`,
        type: 'variable',
      }));

    return [...commonOptions, ...variableOptions];
  };

  // Function to check if form values have changed from original values
  const hasFormChanges = (): boolean => {
    if (!editingItem) return false;

    // If form hasn't been interacted with yet, return false
    if (!formInteracted) return false;

    // Simple check: compare current form values with original values
    try {
      const type = editingItem.type;

      if (type === 'variable') {
        const nameInput = document.getElementById('variable-name') as HTMLInputElement;
        const valueInput = document.getElementById('variable-value') as HTMLInputElement;
        const varName = (nameInput?.value || '').trim();
        const varValue = (valueInput?.value || '').trim();

        return (
          varName !== Object.keys(editingItem.content || {})[0] ||
          varValue !== Object.values(editingItem.content || {})[0]
        );
      }

      if (type === 'set') {
        const keySelect = document.getElementById('set-key') as HTMLSelectElement;
        const valueSelect = document.getElementById('set-value') as HTMLSelectElement;
        const customValue = document.getElementById('set-value-custom') as HTMLInputElement;

        const currentKey = keySelect?.value || '';
        const currentValue = (customValue?.value || valueSelect?.value || '').toString();

        return (
          currentKey !== editingItem.content?.gop_key ||
          currentValue !== editingItem.content?.gop_value
        );
      }

      if (type === 'table') {
        const nameInput = document.getElementById('table-name') as HTMLInputElement;
        const entriesInput = document.getElementById('table-entries') as HTMLInputElement;

        const currentName = (nameInput?.value || '').trim();
        const currentEntries = (entriesInput?.value || '').trim();

        return (
          currentName !== editingItem.content?.name ||
          currentEntries !== (editingItem.content?.entries || []).join(', ')
        );
      }

      if (type === 'rule') {
        // Check basic rule fields
        const actionSelect = document.getElementById('rule-action') as HTMLSelectElement;
        const directionSelect = document.getElementById('rule-direction') as HTMLSelectElement;
        const addressFamilySelect = document.getElementById(
          'rule-address-family'
        ) as HTMLSelectElement;
        const interfaceSelect = document.getElementById('rule-interface') as HTMLSelectElement;
        const protoSelect = document.getElementById('rule-proto') as HTMLSelectElement;
        const fromSelect = document.getElementById('rule-from') as HTMLSelectElement;
        const toSelect = document.getElementById('rule-to') as HTMLSelectElement;
        const portInput = document.getElementById('rule-port') as HTMLInputElement;
        const stateSelect = document.getElementById('rule-state') as HTMLSelectElement;
        const optionsSelect = document.getElementById('rule-options') as HTMLSelectElement;

        // Check if any visible field has changed
        if (actionSelect?.value !== editingItem.content?.action) return true;
        if (directionSelect?.value !== editingItem.content?.direction) return true;
        if (addressFamilySelect?.value !== editingItem.content?.address_family) return true;
        if (interfaceSelect?.value !== editingItem.content?.interface) return true;
        if (protoSelect?.value !== editingItem.content?.proto) return true;

        // Check from field (including custom input)
        const fromCustomInput = document.getElementById('rule-from-custom') as HTMLInputElement;
        let currentFromValue = fromSelect?.value || '';
        if (fromSelect?.value === 'custom' && fromCustomInput) {
          currentFromValue = fromCustomInput.value;
        }
        if (currentFromValue !== editingItem.content?.from) return true;

        // Check to field (including custom input)
        const toCustomInput = document.getElementById('rule-to-custom') as HTMLInputElement;
        let currentToValue = toSelect?.value || '';
        if (toSelect?.value === 'custom' && toCustomInput) {
          currentToValue = toCustomInput.value;
        }
        if (currentToValue !== editingItem.content?.to) return true;

        const currentPorts = Array.isArray(editingItem.content?.ports)
          ? editingItem.content.ports.join(', ')
          : editingItem.content?.ports || '';
        if (portInput?.value !== currentPorts) return true; // Convert array to string for comparison
        if (stateSelect?.value !== editingItem.content?.state) return true;
        if (optionsSelect?.value !== editingItem.content?.options) return true;

        // Check redirect field for NAT and RDR rules
        if (editingItem.content?.action === 'nat' || editingItem.content?.action === 'rdr') {
          const redirectInput = document.getElementById('rule-redirect') as HTMLInputElement;
          if (redirectInput?.value !== editingItem.content?.redirect) return true;
        }

        // Check boolean checkbox fields
        const quickCheckbox = document.getElementById('rule-quick') as HTMLInputElement;
        const logCheckbox = document.getElementById('rule-log') as HTMLInputElement;
        const passCheckbox = document.getElementById('rule-pass') as HTMLInputElement;

        if (quickCheckbox?.checked !== !!editingItem.content?.quick) return true;
        if (logCheckbox?.checked !== !!editingItem.content?.log) return true;
        if (
          editingItem.content?.action === 'rdr' &&
          passCheckbox?.checked !== !!editingItem.content?.pass
        )
          return true;

        // Check toggle states if this is a toggle rule
        if (editingItem.content?.is_toggle && editingItem.content?.toggle_states) {
          // This will be handled by the existing toggle state tracking
          return false;
        }

        return false;
      }

      if (type === 'anchor') {
        const nameInput = document.getElementById('anchor-name') as HTMLInputElement;
        const currentName = (nameInput?.value || '').trim();
        return currentName !== editingItem.content?.name;
      }

      return false;
    } catch (error) {
      logger.error('Error checking form changes', { error });
      return false;
    }
  };

  // Function to get display line number based on actual physical order
  const getDisplayLineNumber = (item: any): number => {
    if (!packetFilters?.items) return item.line || 1;

    // Get all active items (not deleted) sorted by their actual line position
    const activeItems = packetFilters.items
      .filter((activeItem) => activeItem.status !== 'deleted')
      .sort((a, b) => a.line - b.line);

    // Find the actual position of this item in the sorted list
    const actualPosition = activeItems.findIndex(
      (activeItem) => activeItem.line === item.line && activeItem.type === item.type
    );

    // Return the actual physical line number (1-based)
    return actualPosition >= 0 ? actualPosition + 1 : item.line || 1;
  };

  // Function to clear deleted items tracking
  const clearDeletedItems = () => {
    // Reset all deleted items back to normal status
    if (packetFilters?.items) {
      setPacketFilters((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({
          ...item,
          status: item.status === 'deleted' ? undefined : item.status,
        })),
      }));
    }
  };

  // Handle deleting an item
  const handleDeleteItem = (itemToDelete: any) => {
    if (!packetFilters?.items) return;

    // If it's a new item (status === 'new'), completely remove it
    if (itemToDelete.status === 'new') {
      setPacketFilters((prev) => ({
        ...prev,
        items: prev.items.filter(
          (item) => !(item.line === itemToDelete.line && item.type === itemToDelete.type)
        ),
      }));

      setFirewallNotification({
        message: `${itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} removed.`,
        type: 'info',
      });
    } else {
      // For existing items, mark as deleted (allows undo)
      setPacketFilters((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.line === itemToDelete.line && item.type === itemToDelete.type
            ? { ...item, status: 'deleted' }
            : item
        ),
      }));

      setFirewallNotification({
        message: `${itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} marked for deletion. Click undo to restore.`,
        type: 'info',
      });
    }

    // Mark that we have changes to save
    setHasChanges(true);

    // Exit edit mode if we were editing the deleted item
    if (
      isEditMode &&
      editingItem &&
      editingItem.line === itemToDelete.line &&
      editingItem.type === itemToDelete.type
    ) {
      setIsEditMode(false);
      setEditingItem(null);
    }
  };

  // Handle undoing deletion of an item
  const handleUndoDelete = (itemToRestore: any) => {
    if (!packetFilters?.items) return;

    // Restore the item by removing the deleted status
    setPacketFilters((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.line === itemToRestore.line && item.type === itemToRestore.type
          ? { ...item, status: undefined }
          : item
      ),
    }));

    // Mark that we have changes to save
    setHasChanges(true);

    setFirewallNotification({
      message: `${itemToRestore.type.charAt(0).toUpperCase() + itemToRestore.type.slice(1)} restored successfully!`,
      type: 'success',
    });
  };

  // Handle dropping items to reorder (within same type or across types)
  const handleReorderDrop = (e: React.DragEvent, targetType: string, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    logger.info('Reorder drop triggered:', {
      targetType,
      targetIndex,
      targetIndexType: typeof targetIndex,
    });

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      logger.info('Drag data:', dragData);

      // Only allow reordering within the same type - reject cross-type drops
      const isSameType = dragData.type === targetType;
      logger.info('Reorder type:', isSameType ? 'same type' : 'cross-type');

      if (!packetFilters?.items) return;

      // Reject cross-type drops - only allow same-type reordering
      if (!isSameType) {
        logger.info('Cross-type drop rejected - only same-type reordering allowed');
        return;
      }

      const sourceIndex = dragData.index;
      logger.info('Source index:', sourceIndex);

      // Get items of the source type (same as target type since we only allow same-type reordering)
      const sourceTypeItems = packetFilters.items.filter((item) => item.type === dragData.type);

      logger.info('Source type items:', sourceTypeItems);

      // Find the source item
      const sourceItem = sourceTypeItems[sourceIndex];
      if (!sourceItem) {
        logger.info('Source item not found');
        return;
      }

      logger.info('Source item found:', sourceItem);

      // SAME TYPE REORDERING (fixed logic)
      logger.info('Performing same-type reorder');

      if (sourceIndex >= sourceTypeItems.length) {
        logger.info('Invalid source index');
        return;
      }

      // Check if we're dropping to the same position - if so, do nothing
      if (sourceIndex === targetIndex) {
        logger.info('Dropping to same position, no reordering needed');
        return;
      }

      // WORK DIRECTLY WITH THE MAIN ARRAY: Find the actual positions in the main array
      logger.info(
        'Before reordering - Type items:',
        sourceTypeItems.map((item, idx) => ({
          index: idx,
          line: item.line,
          raw: item.raw.substring(0, 30),
        }))
      );

      // Find the actual indices in the main array for the source and target items
      const sourceItemInMain = sourceTypeItems[sourceIndex];
      const targetItemInMain = sourceTypeItems[targetIndex];

      if (!sourceItemInMain || !targetItemInMain) {
        logger.info('Source or target item not found in main array');
        return;
      }

      // Find the actual positions in the main array
      const sourceMainIndex = packetFilters.items.findIndex(
        (item) => item.line === sourceItemInMain.line && item.type === sourceItemInMain.type
      );
      const targetMainIndex = packetFilters.items.findIndex(
        (item) => item.line === targetItemInMain.line && item.type === targetItemInMain.type
      );

      if (sourceMainIndex === -1 || targetMainIndex === -1) {
        logger.info('Could not find source or target item in main array');
        return;
      }

      logger.info('Main array positions:', { sourceMainIndex, targetMainIndex });

      // Create a new array with the reordered items
      const newMainArray = [...packetFilters.items];

      // Remove the source item from its current position
      newMainArray.splice(sourceMainIndex, 1);

      // Calculate the adjusted target position (accounting for the removal)
      let adjustedTargetMainIndex = targetMainIndex;
      if (sourceMainIndex < targetMainIndex) {
        // Moving down: adjust target index to account for the removal
        adjustedTargetMainIndex = targetMainIndex - 1;
      }

      // Insert the source item at the target position
      newMainArray.splice(adjustedTargetMainIndex, 0, sourceItemInMain);

      logger.info('After reordering - Main array positions:', {
        sourceMainIndex,
        targetMainIndex,
        adjustedTargetMainIndex,
        sourceItemLine: sourceItemInMain.line,
        targetItemLine: targetItemInMain.line,
        finalPosition: adjustedTargetMainIndex,
      });

      logger.info(
        'Final array - All items:',
        newMainArray.map((item, idx) => ({
          globalIndex: idx,
          type: item.type,
          line: item.line,
          raw: item.raw.substring(0, 30),
        }))
      );

      // Recalculate line numbers using simple sequential numbering
      const recalculatedItems = recalculateLineNumbers(newMainArray);

      logger.info('Items reordered with sequential line numbers:', recalculatedItems);

      setPacketFilters((prev) => ({
        ...prev,
        items: recalculatedItems,
      }));

      // Mark that we have changes to save
      setHasChanges(true);

      // Auto-scroll to the target section after the reorder
      setTimeout(() => {
        logger.info('Auto-scroll triggered for reorder targetType:', targetType);
        const leftSideContainer = document.querySelector('.left-side-container') as HTMLElement;
        logger.info('Left side container found (reorder):', !!leftSideContainer);

        if (leftSideContainer) {
          // For reordering, we scroll to the target section where the item was moved
          const targetSection = leftSideContainer.querySelector(`[data-type="${targetType}"]`);

          if (targetSection) {
            logger.info('🚀 Scrolling to target section (reorder)...');
            targetSection.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
            logger.info('Scroll command executed (reorder)');
          } else {
            logger.info(
              'Target section not found (reorder). Available data-types:',
              Array.from(leftSideContainer.querySelectorAll('[data-type]')).map((el) =>
                el.getAttribute('data-type')
              )
            );
          }
        } else {
          logger.info('Left side container not found (reorder)');
        }
      }, 100); // Small delay to ensure state update is complete

      // Toast notification removed for reordering

      logger.info('Item reordered successfully');
    } catch (error) {
      logger.error('Error handling reorder drop', { error });
    }
  };

  if (firewall.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div data-testid="server-firewall-container">
        {/* All notifications moved to top for visibility - conditional for simple and advanced modes */}
        {firewall.notification && (
          <div
            className={`mb-4 p-4 rounded-lg shadow-md ${
              firewall.notification.type === 'success'
                ? 'bg-green-100 text-green-800'
                : firewall.notification.type === 'info' && isSimpleMode
                  ? 'bg-blue-100 text-blue-800'
                  : isSimpleMode
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
            } relative`}
            data-testid="server-firewall-notification"
          >
          {isSimpleMode &&
            (firewall.notification.message.includes('validation error') ? (
              <p className=" text-yellow-800">
                {' '}
                Cannot update pf. Please use the advanced mode for this configuration
              </p>
            ) : (
              <p>{firewall.notification.message}</p>
            ))}
          {!isSimpleMode && <p>{firewall.notification.message}</p>}
          <button
            onClick={() => setFirewallNotification(null)}
            className="absolute top-0 right-2 text-gray-500 hover:text-gray-900 focus:outline-none text-sm"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}
      {validationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{validationError}</p>
        </div>
      )}
      {/* Revert Countdown Notification - Moved to top for visibility */}
      {firewall.revertCountdown !== null && firewall.revertCountdown > 0 && (
        <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <div className="text-yellow-800 font-medium">
              Changes will revert in: <span className="font-bold">{firewall.revertCountdown}</span>{' '}
              seconds
            </div>
            <button
              className={`px-4 py-2 rounded-md text-white ${firewall.isCancellingRevert ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={handleCancelRevert}
              disabled={firewall.isCancellingRevert}
            >
              {firewall.isCancellingRevert ? 'Confirming...' : 'Confirm Changes'}
            </button>
          </div>
          <div className="bg-white p-3 rounded-md border border-yellow-300">
            <div className="flex items-start gap-2">
              <div className="text-yellow-600">⚠️</div>
              <div>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Important:</span> You must click &quot;Confirm
                  Changes&quot; to apply these firewall rules permanently. If you don&apos;t
                  confirm, all changes will be automatically reverted when the timer expires.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-2 rounded-lg mb-0">
        {/* Mode Switch */}
        <div className="mb-4 flex items-center justify-end" data-testid="server-firewall-mode-switch">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setIsSimpleMode(true);
                setFirewallNotification(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isSimpleMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="server-firewall-simple-mode-button"
            >
              Simple
            </button>
            <button
              onClick={() => {
                setIsSimpleMode(false);
                setFirewallNotification(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                !isSimpleMode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="server-firewall-advanced-mode-button"
            >
              Advanced
            </button>
          </div>
        </div>

        {isSimpleMode ? (
          /* Simple Mode - Packet Filter Management */
          <div className="space-y-6" data-testid="server-firewall-simple-mode">
            {/* Top Save Button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-800">Packet Filter Management</h2>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Simple mode - drag & drop to reorder, click to edit
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <div className="text-sm text-yellow-600 font-medium">
                      You have unsaved changes - click Save to apply
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (hasChanges) {
                        handleSave();
                      } else {
                        setFirewallNotification({
                          message: 'No changes to save.',
                          type: 'info',
                        });
                      }
                    }}
                    disabled={!hasChanges}
                    className={`px-3 py-2 rounded-md transition-colors font-medium shadow-sm text-sm flex items-center gap-1.5 ${
                      hasChanges
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <FaSave />
                    Save Changes
                  </button>

                  <button
                    onClick={() => {
                      if (hasChanges) {
                        if (
                          window.confirm(
                            'Are you sure you want to cancel all changes? This will revert to the original state.'
                          )
                        ) {
                          handleCancel();
                        }
                      } else {
                        setFirewallNotification({
                          message: 'No changes to cancel.',
                          type: 'info',
                        });
                      }
                    }}
                    disabled={!hasChanges}
                    className={`px-2.5 py-2 rounded-md transition-colors font-medium shadow-sm text-sm flex items-center gap-1.5 ${
                      hasChanges
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 items-start">
              {/* Left Side - Display existing packet filters grouped by type */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm h-[70vh] overflow-y-auto pr-2 left-side-container" data-testid="server-firewall-existing-packet">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">Existing Packet Filters</h3>
                    <Tooltip
                      text="Click on any line to edit it. You can drag and drop items to reorder them within their section."
                      position="right"
                      iconSize={18}
                      iconColor="#2563eb"
                    />
                  </div>
                  <div className="flex gap-2">{/* Reset button removed as requested */}</div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-gray-500">Loading...</p>
                  </div>
                ) : packetFilters ? (
                  <div className="space-y-4">
                    {/* Variables */}
                    {packetFilters.items.filter((item: any) => item.type === 'variable').length >
                      0 && (
                      <div className="border rounded-lg p-3 border-gray-200" data-type="variable" data-testid="server-firewall-varibles">
                        <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center gap-2">
                          Variables
                          {hasDeletedItems('variable') && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              {getDeletedItemsCount('variable')} deleted
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {packetFilters.items
                            .filter((item: any) => item.type === 'variable')
                            .map((item: any, index: number) => {
                              // Calculate the actual position within this type section
                              const typeItems = packetFilters.items
                                .filter((i) => i.type === 'variable')
                                .sort((a, b) => a.line - b.line);
                              const typeIndex = typeItems.findIndex((i) => i.line === item.line);

                              return (
                                <React.Fragment key={index}>
                                  {/* Drop zone above item */}
                                  <div
                                    className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                                    onDrop={(e) => {
                                      logger.info('Drop zone triggered:', {
                                        targetType: 'variable',
                                        targetIndex: typeIndex,
                                        itemLine: item.line,
                                        typeItemsLines: typeItems.map((i) => i.line),
                                      });
                                      const dragData = JSON.parse(
                                        e.dataTransfer.getData('text/plain')
                                      );
                                      if (dragData.isNew) {
                                        handleDropNewItem(e, 'variable', typeIndex);
                                      } else {
                                        handleReorderDrop(e, 'variable', typeIndex);
                                      }
                                      // Hide drop indicator after dropping
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.remove('opacity-0');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    title="Drop here to reorder or add new item"
                                    style={{ minHeight: '12px' }}
                                  >
                                    <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Drop here
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'text/plain',
                                        JSON.stringify({
                                          type: 'variable',
                                          index,
                                          item,
                                          isNew: false,
                                        })
                                      )
                                    }
                                    className={`p-2 rounded text-xs font-mono transition-colors border cursor-pointer hover:shadow-sm ${
                                      isEditMode &&
                                      editingItem &&
                                      editingItem.line === item.line &&
                                      editingItem.type === item.type
                                        ? 'bg-blue-100 border-blue-400 shadow-md hover:bg-blue-200 hover:border-blue-500'
                                        : getItemBorderStyle(item)
                                    } ${item.status === 'deleted' ? 'line-through opacity-60' : ''}`}
                                    data-status={item.status || 'unchanged'}
                                    onClick={() => handleItemClick(item)}
                                    title="Click to edit this item"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 text-xs min-w-[20px]">
                                          {getDisplayLineNumber(item)}
                                        </span>
                                        <span className="text-gray-800">{item.raw}</span>
                                        {getStatusIndicator(item)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.status === 'deleted' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUndoDelete(item);
                                            }}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                            title="Undo deletion"
                                          >
                                            <FaUndo size={12} />
                                          </button>
                                        ) : (
                                          <>
                                            {item.status === 'edited' ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUndoEdit(item);
                                                }}
                                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                                                title="Undo edit"
                                              >
                                                <FaUndo size={12} />
                                              </button>
                                            ) : (
                                              // Show delete button for new items OR when in edit mode
                                              (item.status === 'new' ||
                                                (isEditMode &&
                                                  editingItem &&
                                                  editingItem.line === item.line &&
                                                  editingItem.type === item.type)) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-red-500 text-white-500 rounded hover:bg-red-600 transition-colors"
                                                  title={
                                                    item.status === 'new'
                                                      ? 'Remove this new item'
                                                      : 'Delete this item'
                                                  }
                                                >
                                                  <FaTrash size={12} />
                                                </button>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          {/* Drop zone at end of variables section */}
                          <div
                            className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                            onDrop={(e) => {
                              // Determine the actual target type from the section this drop zone is in
                              const sectionElement = e.currentTarget.closest(
                                '[data-type]'
                              ) as HTMLElement;
                              const actualTargetType =
                                sectionElement?.getAttribute('data-type') || 'variable';
                              logger.info('End drop zone triggered:', {
                                hardcodedType: 'variable',
                                actualTargetType,
                                targetIndex: 'end',
                              });

                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.isNew) {
                                handleDropNewItem(e, actualTargetType);
                              } else {
                                // For reordering, add to end of this type
                                const typeItems =
                                  packetFilters?.items?.filter(
                                    (item) => item.type === actualTargetType
                                  ) || [];
                                handleReorderDrop(e, actualTargetType, typeItems.length);
                              }
                              // Hide drop indicator after dropping
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.remove('opacity-0');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            title="Drop here to reorder or add new item"
                            style={{ minHeight: '12px' }}
                          >
                            <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                              <span className="text-xs text-blue-600 font-medium">Drop here</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sets */}
                    {packetFilters.items.filter((item: any) => item.type === 'set').length > 0 && (
                      <div className="border rounded-lg p-3 border-gray-200" data-type="set">
                        <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center gap-2">
                          Set Options
                          {hasDeletedItems('set') && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              {getDeletedItemsCount('set')} deleted
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {packetFilters.items
                            .filter((item: any) => item.type === 'set')
                            .map((item: any, index: number) => {
                              // Calculate the actual position within this type section
                              const typeItems = packetFilters.items
                                .filter((i) => i.type === 'set')
                                .sort((a, b) => a.line - b.line);
                              const typeIndex = typeItems.findIndex((i) => i.line === item.line);

                              return (
                                <React.Fragment key={index}>
                                  {/* Drop zone above item */}
                                  <div
                                    className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                                    onDrop={(e) => {
                                      logger.info('Drop zone triggered:', {
                                        targetType: 'set',
                                        targetIndex: typeIndex,
                                        itemLine: item.line,
                                        typeItemsLines: typeItems.map((i) => i.line),
                                      });
                                      const dragData = JSON.parse(
                                        e.dataTransfer.getData('text/plain')
                                      );
                                      if (dragData.isNew) {
                                        handleDropNewItem(e, 'set', typeIndex);
                                      } else {
                                        handleReorderDrop(e, 'set', typeIndex);
                                      }
                                      // Hide drop indicator after dropping
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.remove('opacity-0');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    title="Drop here to reorder or add new item"
                                    style={{ minHeight: '12px' }}
                                  >
                                    <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Drop here
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'text/plain',
                                        JSON.stringify({ type: 'set', index, item, isNew: false })
                                      )
                                    }
                                    className={`p-2 rounded text-xs font-mono transition-colors border cursor-pointer hover:shadow-sm ${
                                      isEditMode &&
                                      editingItem &&
                                      editingItem.line === item.line &&
                                      editingItem.type === item.type
                                        ? 'bg-blue-100 border-blue-400 shadow-md hover:bg-blue-200 hover:border-blue-500'
                                        : getItemBorderStyle(item)
                                    } ${item.status === 'deleted' ? 'line-through opacity-60' : ''}`}
                                    data-status={item.status || 'unchanged'}
                                    onClick={() => handleItemClick(item)}
                                    title="Click to edit this item"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 text-xs min-w-[20px]">
                                          {getDisplayLineNumber(item)}
                                        </span>
                                        <span className="text-gray-800">{item.raw}</span>
                                        {getStatusIndicator(item)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.status === 'deleted' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUndoDelete(item);
                                            }}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                            title="Undo deletion"
                                          >
                                            <FaUndo size={12} />
                                          </button>
                                        ) : (
                                          <>
                                            {item.status === 'edited' ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUndoEdit(item);
                                                }}
                                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                                                title="Undo edit"
                                              >
                                                <FaUndo size={12} />
                                              </button>
                                            ) : (
                                              // Show delete button for new items OR when in edit mode
                                              (item.status === 'new' ||
                                                (isEditMode &&
                                                  editingItem &&
                                                  editingItem.line === item.line &&
                                                  editingItem.type === item.type)) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                  title={
                                                    item.status === 'new'
                                                      ? 'Remove this new item'
                                                      : 'Delete this item'
                                                  }
                                                >
                                                  <FaTrash size={12} />
                                                </button>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          {/* Drop zone at end of sets section */}
                          <div
                            className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                            onDrop={(e) => {
                              // Determine the actual target type from the section this drop zone is in
                              const sectionElement = e.currentTarget.closest(
                                '[data-type]'
                              ) as HTMLElement;
                              const actualTargetType =
                                sectionElement?.getAttribute('data-type') || 'set';
                              logger.info('End drop zone triggered:', {
                                hardcodedType: 'set',
                                actualTargetType,
                                targetIndex: 'end',
                              });

                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.isNew) {
                                handleDropNewItem(e, actualTargetType);
                              } else {
                                // For reordering, add to end of this type
                                const typeItems =
                                  packetFilters?.items?.filter(
                                    (item) => item.type === actualTargetType
                                  ) || [];
                                handleReorderDrop(e, actualTargetType, typeItems.length);
                              }
                              // Hide drop indicator after dropping
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.remove('opacity-0');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            title="Drop here to reorder or add new item"
                            style={{ minHeight: '12px' }}
                          >
                            <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                              <span className="text-xs text-blue-600 font-medium">Drop here</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tables */}
                    {packetFilters.items.filter((item: any) => item.type === 'table').length >
                      0 && (
                      <div className="border rounded-lg p-3 border-gray-200" data-type="table">
                        <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center gap-2">
                          Tables
                          {hasDeletedItems('table') && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              {getDeletedItemsCount('table')} deleted
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {packetFilters.items
                            .filter((item: any) => item.type === 'table')
                            .map((item: any, index: number) => {
                              // Calculate the actual position within this type section
                              const typeItems = packetFilters.items
                                .filter((i) => i.type === 'table')
                                .sort((a, b) => a.line - b.line);
                              const typeIndex = typeItems.findIndex((i) => i.line === item.line);

                              return (
                                <React.Fragment key={index}>
                                  {/* Drop zone above item */}
                                  <div
                                    className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                                    onDrop={(e) => {
                                      logger.info('Drop zone triggered:', {
                                        targetType: 'table',
                                        targetIndex: typeIndex,
                                        itemLine: item.line,
                                        typeItemsLines: typeItems.map((i) => i.line),
                                      });
                                      const dragData = JSON.parse(
                                        e.dataTransfer.getData('text/plain')
                                      );
                                      if (dragData.isNew) {
                                        handleDropNewItem(e, 'table', typeIndex);
                                      } else {
                                        handleReorderDrop(e, 'table', typeIndex);
                                      }
                                      // Hide drop indicator after dropping
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.remove('opacity-0');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    title="Drop here to reorder or add new item"
                                    style={{ minHeight: '12px' }}
                                  >
                                    <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Drop here
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'text/plain',
                                        JSON.stringify({ type: 'table', index, item, isNew: false })
                                      )
                                    }
                                    className={`p-2 rounded text-xs font-mono transition-colors border cursor-pointer hover:shadow-sm ${
                                      isEditMode &&
                                      editingItem &&
                                      editingItem.line === item.line &&
                                      editingItem.type === item.type
                                        ? 'bg-blue-100 border-blue-400 shadow-md hover:bg-blue-200 hover:border-blue-500'
                                        : getItemBorderStyle(item)
                                    } ${item.status === 'deleted' ? 'line-through opacity-60' : ''}`}
                                    data-status={item.status || 'unchanged'}
                                    onClick={() => handleItemClick(item)}
                                    title="Click to edit this item"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 text-xs min-w-[20px]">
                                          {getDisplayLineNumber(item)}
                                        </span>
                                        <span className="text-gray-800">{item.raw}</span>
                                        {getStatusIndicator(item)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.status === 'deleted' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUndoDelete(item);
                                            }}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                            title="Undo deletion"
                                          >
                                            <FaUndo size={12} />
                                          </button>
                                        ) : (
                                          <>
                                            {item.status === 'edited' ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUndoEdit(item);
                                                }}
                                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                                                title="Undo edit"
                                              >
                                                <FaUndo size={12} />
                                              </button>
                                            ) : (
                                              // Show delete button for new items OR when in edit mode
                                              (item.status === 'new' ||
                                                (isEditMode &&
                                                  editingItem &&
                                                  editingItem.line === item.line &&
                                                  editingItem.type === item.type)) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                  title={
                                                    item.status === 'new'
                                                      ? 'Remove this new item'
                                                      : 'Delete this item'
                                                  }
                                                >
                                                  <FaTrash size={12} />
                                                </button>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          {/* Drop zone at end of tables section */}
                          <div
                            className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                            onDrop={(e) => {
                              // Determine the actual target type from the section this drop zone is in
                              const sectionElement = e.currentTarget.closest(
                                '[data-type]'
                              ) as HTMLElement;
                              const actualTargetType =
                                sectionElement?.getAttribute('data-type') || 'table';
                              logger.info('End drop zone triggered:', {
                                hardcodedType: 'table',
                                actualTargetType,
                                targetIndex: 'end',
                              });

                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.isNew) {
                                handleDropNewItem(e, actualTargetType);
                              } else {
                                // For reordering, add to end of this type
                                const typeItems =
                                  packetFilters?.items?.filter(
                                    (item) => item.type === actualTargetType
                                  ) || [];
                                handleReorderDrop(e, actualTargetType, typeItems.length);
                              }
                              // Hide drop indicator after dropping
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.remove('opacity-0');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            title="Drop here to reorder or add new item"
                            style={{ minHeight: '12px' }}
                          >
                            <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                              <span className="text-xs text-blue-600 font-medium">Drop here</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rules */}
                    {packetFilters.items.filter((item: any) => item.type === 'rule').length > 0 && (
                      <div className="border rounded-lg p-3 border-gray-200" data-type="rule">
                        <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center gap-2">
                          Rules
                          {hasDeletedItems('rule') && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              {getDeletedItemsCount('rule')} deleted
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {packetFilters.items
                            .filter((item: any) => item.type === 'rule')
                            .map((item: any, index: number) => {
                              // Calculate the actual position within this type section
                              const typeItems = packetFilters.items
                                .filter((i) => i.type === 'rule')
                                .sort((a, b) => a.line - b.line);
                              const typeIndex = typeItems.findIndex((i) => i.line === item.line);

                              return (
                                <React.Fragment key={index}>
                                  {/* Drop zone above item */}
                                  <div
                                    className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                                    onDrop={(e) => {
                                      logger.info('Drop zone triggered:', {
                                        targetType: 'rule',
                                        targetIndex: typeIndex,
                                        itemLine: item.line,
                                        typeItemsLines: typeItems.map((i) => i.line),
                                      });
                                      const dragData = JSON.parse(
                                        e.dataTransfer.getData('text/plain')
                                      );
                                      if (dragData.isNew) {
                                        handleDropNewItem(e, 'rule', typeIndex);
                                      } else {
                                        handleReorderDrop(e, 'rule', typeIndex);
                                      }
                                      // Hide drop indicator after dropping
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.remove('opacity-0');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    title="Drop here to reorder or add new item"
                                    style={{ minHeight: '12px' }}
                                  >
                                    <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Drop here
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'text/plain',
                                        JSON.stringify({ type: 'rule', index, item, isNew: false })
                                      )
                                    }
                                    className={`p-2 rounded text-xs font-mono transition-colors border cursor-pointer hover:shadow-sm ${
                                      isEditMode &&
                                      editingItem &&
                                      editingItem.line === item.line &&
                                      editingItem.type === item.type
                                        ? 'bg-blue-100 border-blue-400 shadow-md hover:bg-blue-200 hover:border-blue-500'
                                        : getItemBorderStyle(item)
                                    } ${item.status === 'deleted' ? 'line-through opacity-60' : ''}`}
                                    data-status={item.status || 'unchanged'}
                                    onClick={() => handleItemClick(item)}
                                    title="Click to edit this item"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 text-xs min-w-[20px]">
                                          {getDisplayLineNumber(item)}
                                        </span>
                                        <span className="text-gray-800">{item.raw}</span>
                                        {item.content?.is_toggle && (
                                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                          </span>
                                        )}
                                        {getStatusIndicator(item)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.status === 'deleted' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUndoDelete(item);
                                            }}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                            title="Undo deletion"
                                          >
                                            <FaUndo size={12} />
                                          </button>
                                        ) : (
                                          <>
                                            {item.status === 'edited' ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUndoEdit(item);
                                                }}
                                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                                                title="Undo edit"
                                              >
                                                <FaUndo size={12} />
                                              </button>
                                            ) : (
                                              // Show delete button for new items OR when in edit mode
                                              (item.status === 'new' ||
                                                (isEditMode &&
                                                  editingItem &&
                                                  editingItem.line === item.line &&
                                                  editingItem.type === item.type)) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                  title={
                                                    item.status === 'new'
                                                      ? 'Remove this new item'
                                                      : 'Delete this item'
                                                  }
                                                >
                                                  <FaTrash size={12} />
                                                </button>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          {/* Drop zone at end of rules section */}
                          <div
                            className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                            onDrop={(e) => {
                              // Determine the actual target type from the section this drop zone is in
                              const sectionElement = e.currentTarget.closest(
                                '[data-type]'
                              ) as HTMLElement;
                              const actualTargetType =
                                sectionElement?.getAttribute('data-type') || 'rule';
                              logger.info('End drop zone triggered:', {
                                hardcodedType: 'rule',
                                actualTargetType,
                                targetIndex: 'end',
                              });

                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.isNew) {
                                handleDropNewItem(e, actualTargetType);
                              } else {
                                // For reordering, add to end of this type
                                const typeItems =
                                  packetFilters?.items?.filter(
                                    (item) => item.type === actualTargetType
                                  ) || [];
                                handleReorderDrop(e, actualTargetType, typeItems.length);
                              }
                              // Hide drop indicator after dropping
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.remove('opacity-0');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            title="Drop here to reorder or add new item"
                            style={{ minHeight: '12px' }}
                          >
                            <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                              <span className="text-xs text-blue-600 font-medium">Drop here</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Anchors */}
                    {packetFilters.items.filter((item: any) => item.type === 'anchor').length >
                      0 && (
                      <div className="border rounded-lg p-3 border-gray-200" data-type="anchor">
                        <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center gap-2">
                          Anchors
                          {hasDeletedItems('anchor') && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              {getDeletedItemsCount('anchor')} deleted
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {packetFilters.items
                            .filter((item: any) => item.type === 'anchor')
                            .map((item: any, index: number) => {
                              // Calculate the actual position within this type section
                              const typeItems = packetFilters.items
                                .filter((i) => i.type === 'anchor')
                                .sort((a, b) => a.line - b.line);
                              const typeIndex = typeItems.findIndex((i) => i.line === item.line);

                              return (
                                <React.Fragment key={index}>
                                  {/* Drop zone above item */}
                                  <div
                                    className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                                    onDrop={(e) => {
                                      logger.info('Drop zone triggered:', {
                                        targetType: 'anchor',
                                        targetIndex: typeIndex,
                                        itemLine: item.line,
                                        typeItemsLines: typeItems.map((i) => i.line),
                                      });
                                      const dragData = JSON.parse(
                                        e.dataTransfer.getData('text/plain')
                                      );
                                      if (dragData.isNew) {
                                        handleDropNewItem(e, 'anchor', typeIndex);
                                      } else {
                                        handleReorderDrop(e, 'anchor', typeIndex);
                                      }
                                      // Hide drop indicator after dropping
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.remove('opacity-0');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    title="Drop here to reorder or add new item"
                                    style={{ minHeight: '12px' }}
                                  >
                                    <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Drop here
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'text/plain',
                                        JSON.stringify({
                                          type: item.type,
                                          index,
                                          item,
                                          isNew: false,
                                        })
                                      )
                                    }
                                    className={`p-2 rounded text-xs font-mono transition-colors border cursor-pointer hover:shadow-sm ${
                                      isEditMode &&
                                      editingItem &&
                                      editingItem.line === item.line &&
                                      editingItem.type === item.type
                                        ? 'bg-blue-100 border-blue-400 shadow-md hover:bg-blue-200 hover:border-blue-500'
                                        : getItemBorderStyle(item)
                                    } ${item.status === 'deleted' ? 'line-through opacity-60' : ''}`}
                                    data-status={item.status || 'unchanged'}
                                    onClick={() => handleItemClick(item)}
                                    title="Click to edit this item"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 text-xs min-w-[20px]">
                                          {getDisplayLineNumber(item)}
                                        </span>
                                        <span className="text-gray-800">{item.raw}</span>
                                        {getStatusIndicator(item)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.status === 'deleted' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUndoDelete(item);
                                            }}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                            title="Undo deletion"
                                          >
                                            <FaUndo size={12} />
                                          </button>
                                        ) : (
                                          <>
                                            {item.status === 'edited' ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUndoEdit(item);
                                                }}
                                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                                                title="Undo edit"
                                              >
                                                <FaUndo size={12} />
                                              </button>
                                            ) : (
                                              // Show delete button for new items OR when in edit mode
                                              (item.status === 'new' ||
                                                (isEditMode &&
                                                  editingItem &&
                                                  editingItem.line === item.line &&
                                                  editingItem.type === item.type)) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                  title={
                                                    item.status === 'new'
                                                      ? 'Remove this new item'
                                                      : 'Delete this item'
                                                  }
                                                >
                                                  <FaTrash size={12} />
                                                </button>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          {/* Drop zone at end of anchors section */}
                          <div
                            className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                            onDrop={(e) => {
                              // Determine the actual target type from the section this drop zone is in
                              const sectionElement = e.currentTarget.closest(
                                '[data-type]'
                              ) as HTMLElement;
                              const actualTargetType =
                                sectionElement?.getAttribute('data-type') || 'anchor';
                              logger.info('End drop zone triggered:', {
                                hardcodedType: 'anchor',
                                actualTargetType,
                                targetIndex: 'end',
                              });

                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.isNew) {
                                handleDropNewItem(e, actualTargetType);
                              } else {
                                // For reordering, add to end of this type
                                const typeItems =
                                  packetFilters?.items?.filter(
                                    (item) => item.type === actualTargetType
                                  ) || [];
                                handleReorderDrop(e, actualTargetType, typeItems.length);
                              }
                              // Hide drop indicator after dropping
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.remove('opacity-0');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            title="Drop here to reorder or add new item"
                            style={{ minHeight: '12px' }}
                          >
                            <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                              <span className="text-xs text-blue-600 font-medium">Drop here</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Anchor Templates */}
                    {packetFilters.items.filter((item: any) => item.type === 'anchor_template')
                      .length > 0 && (
                      <div
                        className="border rounded-lg p-3 border-gray-200"
                        data-type="anchor_template"
                      >
                        <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center gap-2">
                          Anchor Templates
                          {hasDeletedItems('anchor_template') && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              {getDeletedItemsCount('anchor_template')} deleted
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {packetFilters.items
                            .filter((item: any) => item.type === 'anchor_template')
                            .map((item: any, index: number) => {
                              // Calculate the actual position within this type section
                              const typeItems = packetFilters.items
                                .filter((i) => i.type === 'anchor_template')
                                .sort((a, b) => a.line - b.line);
                              const typeIndex = typeItems.findIndex((i) => i.line === item.line);

                              return (
                                <React.Fragment key={index}>
                                  {/* Drop zone above item */}
                                  <div
                                    className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                                    onDrop={(e) => {
                                      logger.info('Drop zone triggered:', {
                                        targetType: 'anchor_template',
                                        targetIndex: typeIndex,
                                        itemLine: item.line,
                                        typeItemsLines: typeItems.map((i) => i.line),
                                      });
                                      const dragData = JSON.parse(
                                        e.dataTransfer.getData('text/plain')
                                      );
                                      if (dragData.isNew) {
                                        handleDropNewItem(e, 'anchor_template', typeIndex);
                                      } else {
                                        handleReorderDrop(e, 'anchor_template', typeIndex);
                                      }
                                      // Hide drop indicator after dropping
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.remove('opacity-0');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove(
                                        'h-4',
                                        'bg-blue-100',
                                        'border-2',
                                        'border-blue-400',
                                        'border-dashed'
                                      );
                                      e.currentTarget
                                        .querySelector('.drop-indicator')
                                        ?.classList.add('opacity-0');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                    }}
                                    title="Drop here to reorder or add new item"
                                    style={{ minHeight: '12px' }}
                                  >
                                    <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                                      <span className="text-xs text-blue-600 font-medium">
                                        Drop here
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData(
                                        'text/plain',
                                        JSON.stringify({
                                          type: item.type,
                                          index,
                                          item,
                                          isNew: false,
                                        })
                                      )
                                    }
                                    className={`p-2 rounded text-xs font-mono transition-colors border cursor-pointer hover:shadow-sm ${
                                      isEditMode &&
                                      editingItem &&
                                      editingItem.line === item.line &&
                                      editingItem.type === item.type
                                        ? 'bg-blue-100 border-blue-400 shadow-md hover:bg-blue-200 hover:border-blue-500'
                                        : getItemBorderStyle(item)
                                    } ${item.status === 'deleted' ? 'line-through opacity-60' : ''}`}
                                    data-status={item.status || 'unchanged'}
                                    onClick={() => handleItemClick(item)}
                                    title="Click to edit this item"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 text-xs min-w-[20px]">
                                          {getDisplayLineNumber(item)}
                                        </span>
                                        <span className="text-gray-800">{item.raw}</span>
                                        {getStatusIndicator(item)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.status === 'deleted' ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUndoDelete(item);
                                            }}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                            title="Undo deletion"
                                          >
                                            <FaUndo size={12} />
                                          </button>
                                        ) : (
                                          <>
                                            {item.status === 'edited' ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUndoEdit(item);
                                                }}
                                                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                                                title="Undo edit"
                                              >
                                                <FaUndo size={12} />
                                              </button>
                                            ) : (
                                              // Show delete button for new items OR when in edit mode
                                              (item.status === 'new' ||
                                                (isEditMode &&
                                                  editingItem &&
                                                  editingItem.line === item.line &&
                                                  editingItem.type === item.type)) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                                  title={
                                                    item.status === 'new'
                                                      ? 'Remove this new item'
                                                      : 'Delete this item'
                                                  }
                                                >
                                                  <FaTrash size={12} />
                                                </button>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          {/* Drop zone at end of anchor templates section */}
                          <div
                            className="h-3 bg-transparent border-0 rounded transition-all duration-200 cursor-pointer group"
                            onDrop={(e) => {
                              // Determine the actual target type from the section this drop zone is in
                              const sectionElement = e.currentTarget.closest(
                                '[data-type]'
                              ) as HTMLElement;
                              const actualTargetType =
                                sectionElement?.getAttribute('data-type') || 'anchor_template';
                              logger.info('End drop zone triggered:', {
                                hardcodedType: 'anchor_template',
                                actualTargetType,
                                targetIndex: 'end',
                              });

                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.isNew) {
                                handleDropNewItem(e, actualTargetType);
                              } else {
                                // For reordering, add to end of this type
                                const typeItems =
                                  packetFilters?.items?.filter(
                                    (item) => item.type === actualTargetType
                                  ) || [];
                                handleReorderDrop(e, actualTargetType, typeItems.length);
                              }
                              // Hide drop indicator after dropping
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.remove('opacity-0');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove(
                                'h-4',
                                'bg-blue-100',
                                'border-2',
                                'border-blue-400',
                                'border-dashed'
                              );
                              e.currentTarget
                                .querySelector('.drop-indicator')
                                ?.classList.add('opacity-0');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                            }}
                            title="Drop here to reorder or add new item"
                            style={{ minHeight: '12px' }}
                          >
                            <div className="drop-indicator h-full flex items-center justify-center opacity-0 transition-opacity">
                              <span className="text-xs text-blue-600 font-medium">Drop here</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500 text-sm mb-2">No packet filters found.</div>
                    <div className="text-xs text-gray-400">
                      Use the right panel to add new rules
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side - Add new packet filters */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm sticky top-4 h-[70vh] overflow-y-auto" data-testid="server-firewall-add-newpacket">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isEditMode ? 'Edit Packet Filter' : 'Add New Packet Filter'}
                    </h3>
                    {!isEditMode && (
                      <div className="text-sm text-gray-500">
                        Select a rule type below to get started
                      </div>
                    )}
                  </div>
                  {isEditMode && (
                    <button
                      onClick={() => setIsEditMode(false)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Add New
                    </button>
                  )}
                </div>

                {/* Type Selection Dropdown - Only show when NOT in edit mode */}
                {!isEditMode && (
                  <div className="mb-6">
                    <label
                      htmlFor="ruleType"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Select Rule Type
                    </label>
                    <select
                      id="ruleType"
                      value={selectedRuleType}
                      onChange={(e) => setSelectedRuleType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="variable">
                        Variables - Define network interfaces and other variables
                      </option>
                      <option value="set">Set Options - Configure firewall behavior options</option>
                      <option value="table">Tables - Define address tables for grouping</option>
                      <option value="rule">Rules - Define pass/block rules</option>
                      <option value="anchor">Anchors - Define NAT/RDR anchors</option>
                      <option value="anchor_template">
                        Anchor Templates - Predefined service configurations
                      </option>
                    </select>
                  </div>
                )}

                {/* Dynamic Component based on selected type */}
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700">
                      {selectedRuleType.charAt(0).toUpperCase() + selectedRuleType.slice(1)}{' '}
                      Configuration
                    </h4>
                  </div>

                  {/* Simple Anchor Template Info */}
                  {selectedRuleType === 'anchor_template' && isEditMode && editingItem && (
                    <div className="space-y-3">
                      <div className="text-xs font-mono bg-gray-100 p-2 rounded border">
                        {editingItem.raw}
                      </div>
                      <div className="text-sm text-gray-500">
                        Use the delete button on the left to remove if not needed.
                      </div>
                    </div>
                  )}

                  {/* Anchor Template Toggle */}
                  {selectedRuleType === 'anchor_template' &&
                    isEditMode &&
                    editingItem &&
                    editingItem.content?.is_toggle &&
                    editingItem.content?.toggle_names &&
                    editingItem.content.toggle_names.length > 0 && (
                      <div className="space-y-3 border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          Anchor Template Toggles
                        </h4>

                        <div className="space-y-2">
                          {editingItem.content.toggle_names.map(
                            (serviceName: string, index: number) => {
                              const isEnabled =
                                editingItem.content?.toggle_states?.[index] === 'enabled';

                              return (
                                <div
                                  key={serviceName}
                                  className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200"
                                >
                                  <div className="flex-1">
                                    <span className="text-sm text-gray-900">{serviceName}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Show confirmation modal instead of immediately executing
                                      const newState = isEnabled ? 'disabled' : 'enabled';
                                      setPendingToggleAction({
                                        serviceName,
                                        serviceIndex: index,
                                        newState,
                                      });
                                      setShowToggleConfirmation(true);
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                      isEnabled ? 'bg-green-600' : 'bg-gray-200'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                        isEnabled ? 'translate-x-4' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}

                  {selectedRuleType === 'variable' && (
                    <div
                      key={`variable-${isEditMode ? editingItem?.line : 'new'}`}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Variable Name</label>
                        <input
                          type="text"
                          placeholder="e.g., ext_if"
                          defaultValue={
                            isEditMode && editingItem?.content
                              ? String(Object.keys(editingItem.content)[0])
                              : ''
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="variable-name"
                          onChange={() => setFormInteracted(true)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Value</label>
                        <input
                          type="text"
                          placeholder="e.g., igc2"
                          defaultValue={
                            isEditMode && editingItem?.content
                              ? String(Object.values(editingItem.content)[0])
                              : ''
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="variable-value"
                          onChange={() => setFormInteracted(true)}
                        />
                      </div>
                      <div className="flex gap-2">
                        {isEditMode ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!hasFormChanges()}
                              className={`flex-1 px-4 py-2 rounded-md transition-colors text-sm ${
                                hasFormChanges()
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              }`}
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const nameInput = document.getElementById(
                                'variable-name'
                              ) as HTMLInputElement;
                              const valueInput = document.getElementById(
                                'variable-value'
                              ) as HTMLInputElement;
                              if (
                                nameInput &&
                                valueInput &&
                                nameInput.value.trim() &&
                                valueInput.value.trim()
                              ) {
                                const formData = {
                                  [nameInput.value.trim()]: valueInput.value.trim(),
                                };
                                handleAddNewFilter('variable', formData);
                                nameInput.value = '';
                                valueInput.value = '';
                              }
                            }}
                            className="w-32 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                          >
                            Add Variable
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRuleType === 'set' && (
                    <div
                      key={`set-${isEditMode ? editingItem?.line : 'new'}`}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Option Name</label>
                        <select
                          value={selectedSetKey}
                          onChange={(e) => {
                            setSelectedSetKey(e.target.value);
                            setFormInteracted(true);
                            // Reset the value dropdown when option changes
                            const valueSelect = document.getElementById(
                              'set-value'
                            ) as HTMLSelectElement;
                            if (valueSelect) {
                              valueSelect.value = '';
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="set-key"
                        >
                          {Object.keys(apiOptions.options_map).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Value</label>
                        {selectedSetKey === 'timeout' ||
                        selectedSetKey === 'skip' ||
                        selectedSetKey === 'fingerprints' ? (
                          <input
                            type="text"
                            defaultValue={
                              isEditMode && editingItem?.content?.gop_value
                                ? editingItem.content.gop_value
                                : ''
                            }
                            placeholder={
                              selectedSetKey === 'timeout'
                                ? 'e.g., { tcp.closing 60, tcp.established 7200 }'
                                : selectedSetKey === 'skip'
                                  ? 'e.g., 0, 1, 2 (interface number)'
                                  : selectedSetKey === 'fingerprints'
                                    ? 'e.g., 0, 1 (0=disabled, 1=enabled)'
                                    : `Enter ${selectedSetKey} value`
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            id="set-value-custom"
                            onChange={() => setFormInteracted(true)}
                          />
                        ) : (
                          <select
                            defaultValue={
                              isEditMode && editingItem?.content?.gop_value
                                ? editingItem.content.gop_value
                                : ''
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            id="set-value"
                            onChange={() => setFormInteracted(true)}
                          >
                            <option value="">Select a value</option>
                            {/* Options will be populated dynamically based on first selection */}
                          </select>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isEditMode ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!hasFormChanges()}
                              className={`flex-1 px-4 py-2 rounded-md transition-colors text-sm ${
                                hasFormChanges()
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              }`}
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const keySelect = document.getElementById(
                                'set-key'
                              ) as HTMLSelectElement;
                              let value: string;

                              if (
                                selectedSetKey === 'timeout' ||
                                selectedSetKey === 'skip' ||
                                selectedSetKey === 'fingerprints'
                              ) {
                                const customInput = document.getElementById(
                                  'set-value-custom'
                                ) as HTMLInputElement;
                                value = customInput?.value || '';
                              } else {
                                const valueSelect = document.getElementById(
                                  'set-value'
                                ) as HTMLSelectElement;
                                value = valueSelect?.value || '';
                              }

                              if (keySelect && value) {
                                const formData = { gop_key: keySelect.value, gop_value: value };
                                handleAddNewFilter('set', formData);
                              }
                            }}
                            className="w-38 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                          >
                            Add Set Option
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRuleType === 'table' && (
                    <div
                      key={`table-${isEditMode ? editingItem?.line : 'new'}`}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Table Name</label>
                        <input
                          type="text"
                          placeholder="e.g., trusted_nets"
                          defaultValue={
                            isEditMode && editingItem?.content?.name ? editingItem.content.name : ''
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="table-name"
                          onChange={() => setFormInteracted(true)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Properties</label>
                        <select
                          defaultValue={
                            isEditMode && editingItem?.content?.properties
                              ? editingItem.content.properties[0]
                              : ''
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="table-properties"
                          onChange={() => setFormInteracted(true)}
                        >
                          <option value="">No properties</option>
                          {['persist', 'const'].map((prop) => (
                            <option key={prop} value={prop}>
                              {prop}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Entries (comma-separated)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 192.168.1.0/24, 10.0.0.0/8"
                          defaultValue={
                            isEditMode && editingItem?.content?.entries
                              ? editingItem.content.entries.join(', ')
                              : ''
                          }
                          className={`w-full px-3 py-2 border rounded-md text-sm ${
                            tableValidationErrors.length > 0
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          id="table-entries"
                          onChange={(e) => {
                            // Clear validation errors when user types
                            if (tableValidationErrors.length > 0) {
                              setTableValidationErrors([]);
                            }
                          }}
                        />
                        {tableValidationErrors.length > 0 && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                            <div className="text-xs text-red-800 font-medium mb-1">
                              Validation Errors:
                            </div>
                            <ul className="text-xs text-red-700 space-y-1">
                              {tableValidationErrors.map((error, index) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span className="text-red-600">•</span>
                                  <span>{error}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isEditMode ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!hasFormChanges()}
                              className={`flex-1 px-4 py-2 rounded-md transition-colors text-sm ${
                                hasFormChanges()
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              }`}
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const nameInput = document.getElementById(
                                'table-name'
                              ) as HTMLInputElement;
                              const propertiesSelect = document.getElementById(
                                'table-properties'
                              ) as HTMLSelectElement;
                              const entriesInput = document.getElementById(
                                'table-entries'
                              ) as HTMLInputElement;

                              if (!nameInput || !nameInput.value.trim()) {
                                setTableValidationErrors(['Table name is required']);
                                return;
                              }

                              // Validate IP addresses if entries are provided
                              if (entriesInput && entriesInput.value.trim()) {
                                const validation = validateIPAddresses(entriesInput.value.trim());
                                if (!validation.isValid) {
                                  setTableValidationErrors(validation.errors);
                                  return;
                                }
                              }

                              // Clear any previous validation errors
                              setTableValidationErrors([]);

                              const formData = {
                                name: nameInput.value.trim(),
                                properties: propertiesSelect.value ? [propertiesSelect.value] : [],
                                entries: entriesInput.value.trim()
                                  ? entriesInput.value
                                      .trim()
                                      .split(',')
                                      .map((e) => e.trim())
                                  : [],
                              };
                              handleAddNewFilter('table', formData);
                              nameInput.value = '';
                              entriesInput.value = '';
                            }}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                          >
                            Add Table
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRuleType === 'rule' && (
                    <div
                      key={`rule-${isEditMode ? editingItem?.line : 'new'}`}
                      className="space-y-3"
                    >
                      {/* Mode Toggle - Only show when adding new rules */}
                      {!isEditMode && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md border border-blue-200">
                          <span className="text-sm font-medium text-blue-800">
                            Rule Creation Mode
                          </span>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-xs ${!isToggleMode ? 'text-blue-900 font-medium' : 'text-blue-600'}`}
                            >
                              Custom
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsToggleMode(!isToggleMode)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                isToggleMode ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                  isToggleMode ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs ${isToggleMode ? 'text-blue-900 font-medium' : 'text-blue-600'}`}
                            >
                              Quick Toggle
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Custom Rule Creation Form */}
                      {!isToggleMode && (
                        <>
                          {availableActions && availableActions.length > 0 ? (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Action</label>
                              <select
                                defaultValue={
                                  isEditMode && editingItem?.content?.action
                                    ? editingItem.content.action
                                    : ''
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                id="rule-action"
                                onChange={(e) => {
                                  setSelectedAction(e.target.value);
                                  setFormInteracted(true);
                                }}
                              >
                                {availableActions.map((action: string) => (
                                  <option key={action} value={action}>
                                    {action}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                          {derivedDirections &&
                          derivedDirections.length > 0 &&
                          selectedAction !== 'nat' &&
                          selectedAction !== 'rdr' ? (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Direction</label>
                              <select
                                defaultValue={
                                  isEditMode && editingItem?.content?.direction
                                    ? editingItem.content.direction
                                    : ''
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                id="rule-direction"
                                onChange={() => setFormInteracted(true)}
                              >
                                <option value="">Select direction</option>
                                {derivedDirections.map((direction: string) => (
                                  <option key={direction} value={direction}>
                                    {direction}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}

                          {/* Modifiers - Moved here to appear after Direction */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-700">Modifiers</h4>

                            {/* Quick option checkbox */}
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="rule-quick"
                                defaultChecked={
                                  isEditMode
                                    ? editingItem?.content?.quick === true ||
                                      (editingItem?.raw && editingItem.raw.includes(' quick '))
                                    : false
                                }
                                onChange={() => setFormInteracted(true)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label
                                htmlFor="rule-quick"
                                className="ml-2 block text-sm text-gray-700"
                              >
                                Quick (stop processing rules after this match)
                              </label>
                            </div>

                            {/* Log option checkbox */}
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="rule-log"
                                defaultChecked={
                                  isEditMode
                                    ? editingItem?.content?.log === true ||
                                      (editingItem?.raw && editingItem.raw.includes(' log '))
                                    : false
                                }
                                onChange={() => setFormInteracted(true)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label
                                htmlFor="rule-log"
                                className="ml-2 block text-sm text-gray-700"
                              >
                                Log (log matching packets)
                              </label>
                            </div>

                            {/* Pass option checkbox - only for RDR rules */}
                            {selectedAction === 'rdr' && (
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id="rule-pass"
                                  defaultChecked={
                                    isEditMode
                                      ? editingItem?.content?.pass === true ||
                                        (editingItem?.raw && editingItem.raw.includes(' pass '))
                                      : false
                                  }
                                  onChange={() => setFormInteracted(true)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor="rule-pass"
                                  className="ml-2 block text-sm text-gray-700"
                                >
                                  Pass (allow traffic to continue after redirect)
                                </label>
                              </div>
                            )}
                          </div>

                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub') {
                              // scrub: shows AddressFamily, Interface, Options
                              return derivedAddressFamily && derivedAddressFamily.length > 0 ? (
                                <div>
                                  <label className="block text-sm text-gray-600 mb-1">
                                    Address Family
                                  </label>
                                  <select
                                    defaultValue={
                                      isEditMode
                                        ? (editingItem?.content?.address_family &&
                                            editingItem.content.address_family) ||
                                          editingItem?.raw
                                            ?.match(/\s(inet6?|inet)\b/i)?.[1]
                                            ?.toLowerCase() ||
                                          ''
                                        : ''
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    id="rule-address-family"
                                    onChange={() => setFormInteracted(true)}
                                  >
                                    <option value="">Select address family</option>
                                    {derivedAddressFamily.map((family: string) => (
                                      <option key={family} value={family}>
                                        {family}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null;
                            }
                            // For other actions, show if AddressFamily is not explicitly null
                            return action?.Dependencies?.AddressFamily !== null ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Address Family
                                </label>
                                <select
                                  defaultValue={
                                    isEditMode
                                      ? (editingItem?.content?.address_family &&
                                          editingItem.content.address_family) ||
                                        editingItem?.raw
                                          ?.match(/\s(inet6?|inet)\b/i)?.[1]
                                          ?.toLowerCase() ||
                                        ''
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-address-family"
                                  onChange={() => setFormInteracted(true)}
                                >
                                  <option value="">Select address family</option>
                                  {derivedAddressFamily && derivedAddressFamily.length > 0 ? (
                                    derivedAddressFamily.map((family: string) => (
                                      <option key={family} value={family}>
                                        {family}
                                      </option>
                                    ))
                                  ) : (
                                    // Provide default options if no specific options are available
                                    <>
                                      <option value="inet">inet</option>
                                      <option value="inet6">inet6</option>
                                    </>
                                  )}
                                </select>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'antispoof') {
                              // scrub and antispoof: always show Interface
                              return (
                                <div>
                                  <label className="block text-sm text-gray-600 mb-1">
                                    Interface
                                  </label>
                                  <select
                                    defaultValue={
                                      isEditMode && editingItem?.content?.interface
                                        ? editingItem.content.interface
                                        : ''
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    id="rule-interface"
                                    disabled={interfacesLoading}
                                    onChange={() => setFormInteracted(true)}
                                  >
                                    <option value="">Select an interface</option>
                                    {getInterfaceOptions().map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                        className={
                                          option.type === 'variable' ? 'text-blue-600' : ''
                                        }
                                      >
                                        {option.display}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Variables are prefixed with $ and shown in blue
                                  </div>
                                </div>
                              );
                            }
                            // For other actions, show if Interface is not explicitly null
                            return action?.Dependencies?.Interface !== null ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Interface
                                </label>
                                <select
                                  defaultValue={
                                    isEditMode && editingItem?.content?.interface
                                      ? editingItem.content.interface
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-interface"
                                  disabled={interfacesLoading}
                                  onChange={() => setFormInteracted(true)}
                                >
                                  <option value="">Select an interface</option>
                                  {getInterfaceOptions().map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                      className={option.type === 'variable' ? 'text-blue-600' : ''}
                                    >
                                      {option.display}
                                    </option>
                                  ))}
                                </select>
                                <div className="mt-1 text-xs text-gray-500">
                                  Variables are prefixed with $ and shown in blue
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'antispoof') {
                              // scrub and antispoof: don't show Protocol
                              return null;
                            }
                            // For other actions, show if Protocols is not explicitly null and derivedProtocols is available
                            return action?.Dependencies?.Protocols !== null &&
                              derivedProtocols &&
                              derivedProtocols.length > 0 ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Protocol</label>
                                <select
                                  defaultValue={
                                    isEditMode && editingItem?.content?.proto
                                      ? editingItem.content.proto
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-proto"
                                  onChange={() => setFormInteracted(true)}
                                >
                                  <option value="">Select protocol</option>
                                  {derivedProtocols.map((protocol: string) => (
                                    <option key={protocol} value={protocol}>
                                      {protocol}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'antispoof') {
                              // scrub and antispoof: don't show Source
                              return null;
                            }
                            // For other actions, show if SourceDest is not explicitly null
                            return action?.Dependencies?.SourceDest !== null ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Source</label>
                                <select
                                  defaultValue={
                                    isEditMode &&
                                    editingItem?.raw &&
                                    /\sfrom\s+\S+/.test(editingItem.raw)
                                      ? editingItem?.content?.from || ''
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-from"
                                  onChange={(e) => {
                                    setFormInteracted(true);
                                    // If user selects "custom", show input field
                                    if (e.target.value === 'custom') {
                                      const customInput =
                                        document.getElementById('rule-from-custom');
                                      if (customInput) {
                                        customInput.style.display = 'block';
                                        customInput.focus();
                                      }
                                    } else {
                                      const customInput =
                                        document.getElementById('rule-from-custom');
                                      if (customInput) {
                                        customInput.style.display = 'none';
                                      }
                                    }
                                  }}
                                >
                                  <option value="">Select source or type custom value</option>
                                  <option value="custom">-- Type Custom Value --</option>
                                  {getSourceDestOptions().map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                      className={option.type === 'variable' ? 'text-blue-600' : ''}
                                    >
                                      {option.display}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  id="rule-from-custom"
                                  placeholder="e.g., 192.168.1.0/24, 10.0.0.5"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-2 hidden"
                                  style={{ display: 'none' }}
                                  onChange={() => setFormInteracted(true)}
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                  Select from predefined options or choose &quot;Type Custom
                                  Value&quot; to enter custom IP/network. Variables are prefixed
                                  with $.
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'antispoof') {
                              // scrub and antispoof: don't show Destination
                              return null;
                            }
                            // For other actions, show if SourceDest is not explicitly null
                            return action?.Dependencies?.SourceDest !== null ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Destination
                                </label>
                                <select
                                  defaultValue={
                                    isEditMode &&
                                    editingItem?.raw &&
                                    /\sto\s+\S+/.test(editingItem.raw)
                                      ? editingItem?.content?.to || ''
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-to"
                                  onChange={(e) => {
                                    setFormInteracted(true);
                                    // If user selects "custom", show input field
                                    if (e.target.value === 'custom') {
                                      const customInput = document.getElementById('rule-to-custom');
                                      if (customInput) {
                                        customInput.style.display = 'block';
                                        customInput.focus();
                                      }
                                    } else {
                                      const customInput = document.getElementById('rule-to-custom');
                                      if (customInput) {
                                        customInput.style.display = 'none';
                                      }
                                    }
                                  }}
                                >
                                  <option value="">Select destination or type custom value</option>
                                  <option value="custom">-- Type Custom Value --</option>
                                  {getSourceDestOptions().map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                      className={option.type === 'variable' ? 'text-blue-600' : ''}
                                    >
                                      {option.display}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  id="rule-to-custom"
                                  placeholder="e.g., 192.168.1.100, 10.0.0.0/8"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-2 hidden"
                                  style={{ display: 'none' }}
                                  onChange={() => setFormInteracted(true)}
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                  Select from predefined options or choose &quot;Type Custom
                                  Value&quot; to enter custom IP/network. Variables are prefixed
                                  with $.
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'antispoof') {
                              // scrub and antispoof: don't show Port
                              return null;
                            }
                            // For other actions, show if Protocols is not explicitly null
                            return action?.Dependencies?.Protocols !== null ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Port</label>
                                <input
                                  type="text"
                                  defaultValue={
                                    isEditMode && editingItem?.content?.port
                                      ? editingItem.content.port
                                      : ''
                                  }
                                  placeholder="e.g., 80, 443, 22"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-port"
                                  onChange={() => setFormInteracted(true)}
                                />
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'antispoof') {
                              // scrub and antispoof: don't show State
                              return null;
                            }
                            // For other actions, show if States is not explicitly null and derivedStates is available
                            return action?.Dependencies?.States !== null &&
                              derivedStates &&
                              derivedStates.length > 0 ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">State</label>
                                <select
                                  defaultValue={
                                    isEditMode && editingItem?.content?.state
                                      ? editingItem.content.state
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-state"
                                  onChange={() => setFormInteracted(true)}
                                >
                                  <option value="">Select state</option>
                                  {derivedStates.length ? (
                                    derivedStates.map((state: string) => (
                                      <option key={state} value={state}>
                                        {state}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="">N/A</option>
                                  )}
                                </select>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            // Show redirect field only for NAT and RDR rules
                            if (selectedAction === 'nat' || selectedAction === 'rdr') {
                              return (
                                <div>
                                  <label className="block text-sm text-gray-600 mb-1">
                                    Redirect
                                  </label>
                                  <input
                                    type="text"
                                    defaultValue={
                                      isEditMode && editingItem?.content?.redirect
                                        ? editingItem.content.redirect.replace(/^->\s*/, '')
                                        : ''
                                    }
                                    placeholder="e.g., 127.0.0.1 port 8021"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    id="rule-redirect"
                                    onChange={() => setFormInteracted(true)}
                                  />
                                  <div className="mt-1 text-xs text-gray-500">
                                    Enter the redirect target (e.g., IP address and port)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {(() => {
                            const source =
                              apiOptions.pf_rule_actions_details &&
                              apiOptions.pf_rule_actions_details.length
                                ? apiOptions.pf_rule_actions_details
                                : [];
                            const action = source.find((a: any) => a.Value === selectedAction);
                            // Special handling for specific actions
                            if (selectedAction === 'scrub' || selectedAction === 'rdr') {
                              // scrub and antispoof: always show Options
                              return derivedOptions && derivedOptions.length > 0 ? (
                                <div>
                                  <label className="block text-sm text-gray-600 mb-1">
                                    Options
                                  </label>
                                  <select
                                    defaultValue={
                                      isEditMode && editingItem?.content?.options
                                        ? Array.isArray(editingItem.content.options)
                                          ? editingItem.content.options[0] || ''
                                          : typeof editingItem.content.options === 'string'
                                            ? editingItem.content.options
                                                .split(/\s+/)
                                                .filter(Boolean)[0] || ''
                                            : ''
                                        : ''
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    id="rule-options"
                                  >
                                    <option value="">No options</option>
                                    {derivedOptions.map((option: string) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null;
                            }
                            // For other actions, show if Options is not explicitly null and derivedOptions is available
                            return action?.Dependencies?.Options !== null &&
                              derivedOptions &&
                              derivedOptions.length > 0 ? (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Options</label>
                                <select
                                  defaultValue={
                                    isEditMode && editingItem?.content?.options
                                      ? Array.isArray(editingItem.content.options)
                                        ? editingItem.content.options[0] || ''
                                        : typeof editingItem.content.options === 'string'
                                          ? editingItem.content.options
                                              .split(/\s+/)
                                              .filter(Boolean)[0] || ''
                                          : ''
                                      : ''
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  id="rule-options"
                                >
                                  <option value="">No options</option>
                                  {derivedOptions.map((option: string) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null;
                          })()}

                          {/* Toggle Options - Show in edit mode for toggle rules */}
                          {isEditMode &&
                            editingItem?.content?.is_toggle &&
                            editingItem.content?.toggle_names &&
                            editingItem.content.toggle_names.length > 0 && (
                              <div className="space-y-3 border-t pt-4 mt-4">
                                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  Service Toggles
                                </h4>

                                <div className="space-y-2">
                                  {editingItem.content.toggle_names.map(
                                    (serviceName: string, index: number) => {
                                      const isEnabled =
                                        editingItem.content?.toggle_states?.[index] === 'enabled';

                                      return (
                                        <div
                                          key={serviceName}
                                          className="flex items-center justify-between p-2 bg-white rounded-md border border-gray-200"
                                        >
                                          <div className="flex-1">
                                            <span className="text-sm text-gray-900">
                                              {serviceName}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // Show confirmation modal instead of immediately executing
                                              const newState = isEnabled ? 'disabled' : 'enabled';
                                              setPendingToggleAction({
                                                serviceName,
                                                serviceIndex: index,
                                                newState,
                                              });
                                              setShowToggleConfirmation(true);
                                            }}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                              isEnabled ? 'bg-green-600' : 'bg-gray-200'
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                isEnabled ? 'translate-x-4' : 'translate-x-1'
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}

                          <div className="flex gap-2">
                            {isEditMode ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={!hasFormChanges()}
                                  className={`flex-1 px-4 py-2 rounded-md transition-colors text-sm ${
                                    hasFormChanges()
                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                  }`}
                                >
                                  Save Changes
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  const actionSelect = document.getElementById(
                                    'rule-action'
                                  ) as HTMLSelectElement;
                                  const directionSelect = document.getElementById(
                                    'rule-direction'
                                  ) as HTMLSelectElement;
                                  const addressFamilySelect = document.getElementById(
                                    'rule-address-family'
                                  ) as HTMLSelectElement;
                                  const interfaceInput = document.getElementById(
                                    'rule-interface'
                                  ) as HTMLInputElement;
                                  const protoSelect = document.getElementById(
                                    'rule-proto'
                                  ) as HTMLSelectElement;
                                  const fromInput = document.getElementById(
                                    'rule-from'
                                  ) as HTMLInputElement;
                                  const toInput = document.getElementById(
                                    'rule-to'
                                  ) as HTMLInputElement;
                                  const portInput = document.getElementById(
                                    'rule-port'
                                  ) as HTMLInputElement;
                                  const stateSelect = document.getElementById(
                                    'rule-state'
                                  ) as HTMLSelectElement;
                                  const optionsSelect = document.getElementById(
                                    'rule-options'
                                  ) as HTMLSelectElement;

                                  if (actionSelect) {
                                    // Get the current action to determine what fields are needed
                                    const currentAction = actionSelect.value;

                                    // Find the action details to know what fields are required
                                    const source =
                                      apiOptions.pf_rule_actions_details &&
                                      apiOptions.pf_rule_actions_details.length
                                        ? apiOptions.pf_rule_actions_details
                                        : [];
                                    const actionDetails = source.find(
                                      (a: any) => a.Value === currentAction
                                    );

                                    // For nat/rdr actions, direction is completely irrelevant
                                    const isNatOrRdr =
                                      currentAction === 'nat' || currentAction === 'rdr';

                                    // Get boolean checkbox values
                                    const quickCheckbox = document.getElementById(
                                      'rule-quick'
                                    ) as HTMLInputElement;
                                    const logCheckbox = document.getElementById(
                                      'rule-log'
                                    ) as HTMLInputElement;
                                    const passCheckbox = document.getElementById(
                                      'rule-pass'
                                    ) as HTMLInputElement;

                                    const formData = {
                                      action: currentAction,
                                      direction: isNatOrRdr ? '' : directionSelect?.value || '', // No direction for nat/rdr
                                      address_family: addressFamilySelect?.value || '',
                                      interface: interfaceInput?.value || '',
                                      proto: protoSelect?.value || '',
                                      state: stateSelect?.disabled ? '' : stateSelect?.value || '',
                                      from: fromInput?.value || '',
                                      to: toInput?.value || '',
                                      port: portInput?.value || '',
                                      redirect:
                                        currentAction === 'nat' || currentAction === 'rdr'
                                          ? (
                                              (
                                                document.getElementById(
                                                  'rule-redirect'
                                                ) as HTMLInputElement
                                              )?.value || ''
                                            ).replace(/^->\s*/, '')
                                          : '',
                                      quick: quickCheckbox?.checked || false,
                                      log: logCheckbox?.checked || false,
                                      pass:
                                        currentAction === 'rdr'
                                          ? passCheckbox?.checked || false
                                          : false,
                                      options: optionsSelect?.value || '',
                                    };
                                    handleAddNewFilter('rule', formData);
                                  }
                                }}
                                className="w-24 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                              >
                                Add Rule
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {/* Quick Toggle Features - Only show when adding new rules */}
                      {!isEditMode && isToggleMode && (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Quick Toggle Features
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(apiOptions.toggle_constants)
                              .filter(([key, value]) => {
                                const serviceKey = value as string;
                                // Filter out http, https, ftp_proxy, and icmp services (moved to anchor templates)
                                return (
                                  serviceKey !== 'http' &&
                                  serviceKey !== 'https' &&
                                  serviceKey !== 'ftp_proxy' &&
                                  serviceKey !== 'icmp'
                                );
                              })
                              .map(([key, value]) => {
                                const serviceKey = value as string;
                                const serviceLabel = key
                                  .replace('PF_TOGGLE_', '')
                                  .replace(/_/g, ' ');
                                const servicePort = getServicePort(serviceKey);
                                const serviceDescription = getServiceDescription(serviceKey);

                                return (
                                  <div
                                    key={serviceKey}
                                    className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-200"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">
                                          {serviceLabel}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          ({servicePort})
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {serviceDescription}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Toggle the service state
                                        const newState = !serviceToggles[serviceKey];
                                        setServiceToggles((prev) => ({
                                          ...prev,
                                          [serviceKey]: newState,
                                        }));

                                        // Remove any existing rules for this service first
                                        // Check both the toggle_type and content.toggle_type properties
                                        setNewFilters((prev) =>
                                          prev.filter((filter) => {
                                            const filterToggleType =
                                              filter.toggle_type || filter.content?.toggle_type;
                                            return (
                                              !filterToggleType || filterToggleType !== serviceKey
                                            );
                                          })
                                        );

                                        // Add only the current state rule
                                        if (newState) {
                                          // Enable service - use TRUE template
                                          const templateKey = `PF_TOGGLE_${serviceKey.toUpperCase()}_TRUE`;
                                          const templates = apiOptions.rule_templates[templateKey];

                                          if (
                                            templates &&
                                            Array.isArray(templates) &&
                                            templates.length > 0
                                          ) {
                                            // Only use the first template to generate one rule
                                            const template = templates[0];
                                            // Determine the correct type based on template content
                                            const templateType = template
                                              .trim()
                                              .startsWith('include')
                                              ? 'anchor_template'
                                              : 'rule';

                                            const formData = {
                                              action: 'pass',
                                              direction: 'in',
                                              proto: serviceKey === 'icmp' ? 'icmp' : 'tcp',
                                              state: 'keep',
                                              interface: '',
                                              from: 'any',
                                              to: 'any',
                                              port:
                                                serviceKey === 'icmp'
                                                  ? ''
                                                  : getServicePort(serviceKey),
                                              raw: template.replace(/^#/, ''), // Remove hash to make commented includes active
                                              isTemplateGenerated: true,
                                              toggle_type: serviceKey, // Add this to identify the rule
                                            };
                                            handleAddNewFilter(templateType, formData);
                                          }
                                        } else {
                                          // Disable service - use FALSE template
                                          const templateKey = `PF_TOGGLE_${serviceKey.toUpperCase()}_FALSE`;
                                          const templates = apiOptions.rule_templates[templateKey];

                                          if (
                                            templates &&
                                            Array.isArray(templates) &&
                                            templates.length > 0
                                          ) {
                                            // Only use the first template to generate one rule
                                            const template = templates[0];
                                            // Determine the correct type based on template content
                                            const templateType = template
                                              .trim()
                                              .startsWith('include')
                                              ? 'anchor_template'
                                              : 'rule';

                                            const formData = {
                                              action: 'block',
                                              direction: 'in',
                                              proto: serviceKey === 'icmp' ? 'icmp' : 'tcp',
                                              state: '',
                                              interface: '',
                                              from: 'any',
                                              to: 'any',
                                              port:
                                                serviceKey === 'icmp'
                                                  ? ''
                                                  : getServicePort(serviceKey),
                                              raw: template.replace(/^#/, ''), // Remove hash to make commented includes active
                                              isTemplateGenerated: true,
                                              toggle_type: serviceKey, // Add this to identify the rule
                                            };
                                            handleAddNewFilter(templateType, formData);
                                          }
                                        }
                                      }}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                        serviceToggles[serviceKey] ? 'bg-green-600' : 'bg-gray-200'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          serviceToggles[serviceKey]
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                          <div className="mt-3 text-xs text-gray-500">
                            Toggle services to automatically generate firewall rules. Enabled
                            services will appear in the &quot;Newly Added Filters&quot; section
                            below.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedRuleType === 'anchor' && (
                    <div
                      key={`anchor-${isEditMode ? editingItem?.line : 'new'}`}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Anchor Type</label>
                        <select
                          defaultValue={
                            isEditMode && editingItem?.content?.type
                              ? editingItem.content.type
                              : 'nat-anchor'
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="anchor-type"
                          onChange={() => setFormInteracted(true)}
                        >
                          <option value="nat-anchor">NAT Anchor</option>
                          <option value="rdr-anchor">RDR Anchor</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Anchor Name</label>
                        <input
                          type="text"
                          placeholder="e.g., ftp-proxy/*"
                          defaultValue={
                            isEditMode && editingItem?.content?.name ? editingItem.content.name : ''
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          id="anchor-name"
                          onChange={() => setFormInteracted(true)}
                        />
                      </div>
                      <div className="flex gap-2">
                        {isEditMode ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!hasFormChanges()}
                              className={`flex-1 px-4 py-2 rounded-md transition-colors text-sm ${
                                hasFormChanges()
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              }`}
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              const typeSelect = document.getElementById(
                                'anchor-type'
                              ) as HTMLSelectElement;
                              const nameInput = document.getElementById(
                                'anchor-name'
                              ) as HTMLInputElement;
                              if (typeSelect && nameInput && nameInput.value.trim()) {
                                const formData = {
                                  type: typeSelect.value,
                                  name: nameInput.value.trim(),
                                };
                                handleAddNewFilter('anchor', formData);
                                nameInput.value = '';
                              }
                            }}
                            className="w-32 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                          >
                            Add Anchor
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRuleType === 'anchor_template' && (
                    <div
                      key={`anchor_template-${isEditMode ? editingItem?.line : 'new'}`}
                      className="space-y-3"
                    >
                      {/* FTP Proxy and ICMP Toggle Services */}
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          {isEditMode
                            ? 'Anchor Template Service'
                            : 'Available Anchor Template Services'}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                          {(isEditMode && editingItem?.type === 'anchor_template'
                            ? (() => {
                                // Determine which service this anchor template controls
                                if (editingItem.content?.toggle_type) {
                                  return [editingItem.content.toggle_type];
                                } else {
                                  // Fallback: determine from raw content
                                  const rawContent =
                                    editingItem.content?.raw || editingItem.raw || '';
                                  if (rawContent.includes('ftp') || rawContent.includes('2121')) {
                                    return ['ftp_proxy'];
                                  } else if (rawContent.includes('icmp')) {
                                    return ['icmp'];
                                  } else {
                                    return ['ftp_proxy']; // Default fallback
                                  }
                                }
                              })()
                            : ['ftp_proxy', 'icmp']
                          ) // Show all services when adding new
                            .map((serviceKey) => {
                              const serviceLabel =
                                serviceKey === 'ftp_proxy' ? 'FTP Proxy' : 'ICMP';
                              const servicePort = getServicePort(serviceKey);
                              const serviceDescription = getServiceDescription(serviceKey);
                              // For anchor templates in edit mode, use the editing item's is_enabled directly
                              const isEnabled =
                                isEditMode && editingItem?.type === 'anchor_template'
                                  ? editingItem.content?.is_enabled || false
                                  : serviceToggles[serviceKey] || false;

                              return (
                                <div
                                  key={serviceKey}
                                  className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-200"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {serviceLabel}
                                      </span>
                                      <span className="text-xs text-gray-500">({servicePort})</span>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {serviceDescription}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Show confirmation modal for anchor template toggles
                                      const newState = !isEnabled;
                                      setPendingToggleAction({
                                        type: 'anchor_template',
                                        serviceName:
                                          serviceKey === 'ftp_proxy' ? 'FTP Proxy' : 'ICMP',
                                        serviceIndex: 0,
                                        serviceKey,
                                        newState,
                                        editingItem: editingItem,
                                        isEditMode: isEditMode,
                                      });
                                      setShowToggleConfirmation(true);
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                      isEnabled ? 'bg-green-600' : 'bg-gray-200'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                        isEnabled ? 'translate-x-4' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* New Filters Section - Right Side */}
                {newFilters.length > 0 && (
                  <div className="mt-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-blue-800 text-sm">
                        Newly Added Packet Filters
                      </h4>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                        Drag to left side to apply
                      </span>
                    </div>
                    <p className="text-blue-700 text-xs mb-3 italic">
                      💡 Drag these newly created rules to the left side sections to apply them to
                      your firewall configuration
                    </p>
                    <div className="space-y-2">
                      {newFilters.map((item: any, index: number) => (
                        <div
                          key={`new-${index}`}
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData(
                              'text/plain',
                              JSON.stringify({ type: item.type, index, item, isNew: true })
                            )
                          }
                          className="p-3 rounded text-xs font-mono transition-colors border-2 border-blue-300 cursor-grab bg-white hover:shadow-sm hover:border-blue-400"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-800">{item.raw}</span>
                              {getStatusIndicator(item)}
                            </div>
                            <button
                              onClick={() => {
                                setNewFilters((prev) => prev.filter((_, i) => i !== index));
                                // Don't decrement nextLineNumber since we're not using it for new items
                              }}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info about Simple Mode */}
                <div className="mt-6 my-auto p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div>
                      <h3 className="text-green-800 font-semibold mb-1 text-sm">Simple Mode</h3>
                      <p className="text-green-700 text-sm">
                        Quick and easy firewall rules. Perfect for most common needs.
                      </p>
                      <p
                        className="text-green-700 text-sm mt-2 cursor-pointer"
                        onClick={() => setIsSimpleMode(false)}
                      >
                        Need more options? Switch to <strong>Advanced Mode</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save and Debug Buttons */}
                {/* <div className="mt-6 flex flex-col gap-3">



                    <button
                      onClick={() => setDebugModalOpen(true)}
                      className="px-2 py-2 w-32 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
                    >
                       Debug Payload
                    </button>
                 </div> */}
              </div>
            </div>
          </div>
        ) : (
          /* Advanced Mode - All existing functionality untouched */
          <>
            {/* Warning Notice */}
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-amber-500 text-xl">⚠️</div>
                <div>
                  <h3 className="text-amber-800 font-semibold mb-1" data-testid="server-firewall-advanced-warning">
                    Warning: Advanced Configuration
                  </h3>
                  <p className="text-amber-700 text-sm">
                    PF (Packet Filter) is powerful but complex. You should only edit these rules if
                    you know exactly what you are doing. Incorrect firewall rules can lock you out
                    of the system or create security vulnerabilities.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-2" data-testid="server-firewall-advanced-header">
              <h2 className="text-2xl font-bold text-gray-800 mb-1.5" data-testid="server-firewall-title">Packet Filter Rules</h2>
              {hasChanges && (
                <div className="text-sm text-yellow-600 font-medium" data-testid="server-firewall-unsaved-changes">You have unsaved changes</div>
              )}
            </div>
            <div className="relative bg-white rounded-lg shadow-sm" data-testid="server-firewall-editor-container">
              <br />
              <div data-testid="server-firewall-monaco-editor">
                <MonacoEditor
                  height="400px"
                  defaultLanguage="shell"
                  value={localRules}
                  onChange={handleRuleChange}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    monacoRef.current = monaco;

                    // Register custom language for firewall rules
                    monaco.languages.register({ id: 'firewall-rules' });
                    monaco.languages.setMonarchTokensProvider('firewall-rules', {
                      tokenizer: {
                        root: [
                          // Match keywords
                          [
                            /\b(pass|block|in|out|all|inet|inet6|proto|from|to|port|icmp-type)\b/,
                            'keyword',
                          ],
                          // Match comments
                          [/#.*$/, 'comment'],
                          // Match numbers (ports, addresses)
                          [/\b\d+(\.\d+){0,3}(\/\d+)?\b/, 'number'],
                          // Match quoted strings
                          [/".*?"/, 'string'],
                          [/'.*?'/, 'string'],
                          // Match IP addresses
                          [/\b\d+\.\d+\.\d+\.\d+\b/, 'constant'],
                          // Match operators
                          [/[<>!=]=?/, 'operator'],
                          // Match special identifiers
                          [/\${[^}]*}/, 'variable'],
                        ],
                      },
                    });

                    // Set the language
                    const model = editor.getModel();
                    if (model) {
                      monaco.editor.setModelLanguage(model, 'firewall-rules');
                    }
                  }}
                options={{
                  selectOnLineNumbers: true,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  folding: true,
                  matchBrackets: 'always',
                  lineDecorationsWidth: 10,
                  renderLineHighlight: 'all',
                }}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 " data-testid="server-firewall-actions">
                <button
                  onClick={handleCancel}
                  disabled={!hasChanges || firewall.revertCountdown !== null}
                  className={`mr-2 mb-3 px-4 py-2 rounded-md transition-colors ${
                    !hasChanges || firewall.revertCountdown !== null
                      ? 'bg-gray-300 text-gray-800 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                  }`}
                  data-testid="server-firewall-cancel-button"
                >
                  Cancel
                </button>
                {/* <button
                    onClick={handleCopy}
                    className=" mr-2 mb-3 flex items-center px-2 py-1 bg-karios-blue text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    <FaRegCopy />
                  </button> */}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || !localRules.trim() || firewall.revertCountdown !== null}
                  className={`px-2 py-2 rounded-md mr-6 mb-3 text-white transition-colors
                    ${
                      !hasChanges || !localRules.trim() || firewall.revertCountdown !== null
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-karios-blue hover:bg-blue-600'
                    }`}
                  data-testid="server-firewall-save-button"
                >
                  <FaSave />
                </button>
              </div>
            </div>
            {/* Removed notifications from here - now at top */}
          </>
        )}
      </div>

      {/* Approval Modal */}
      <ApprovalModal {...modalProps} data-testid="server-firewall-approval-modal" />

      {/* Toggle Confirmation Modal */}
      {showToggleConfirmation && pendingToggleAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Service Toggle</h3>
              <button
                onClick={() => {
                  setShowToggleConfirmation(false);
                  setPendingToggleAction(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                {pendingToggleAction.type === 'anchor_template'
                  ? `Are you sure you want to ${pendingToggleAction.newState ? 'enable' : 'disable'} the anchor template service:`
                  : `Are you sure you want to ${pendingToggleAction.newState === 'enabled' ? 'enable' : 'disable'} the service:`}
              </p>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded border">
                {pendingToggleAction.type === 'anchor_template'
                  ? pendingToggleAction.serviceKey === 'ftp_proxy'
                    ? 'FTP Proxy'
                    : 'ICMP'
                  : pendingToggleAction.serviceName}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Current state:{' '}
                <span
                  className={`font-medium ${pendingToggleAction.newState === 'enabled' || pendingToggleAction.newState === true ? 'text-red-600' : 'text-green-600'}`}
                >
                  {pendingToggleAction.newState === 'enabled' ||
                  pendingToggleAction.newState === true
                    ? 'Disabled'
                    : 'Enabled'}
                </span>
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowToggleConfirmation(false);
                  setPendingToggleAction(null);
                }}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Execute the pending toggle action
                  if (pendingToggleAction) {
                    if (pendingToggleAction.type === 'anchor_template') {
                      // Handle anchor template toggle
                      const newState = pendingToggleAction.newState;
                      const serviceKey = pendingToggleAction.serviceKey;
                      const editingItem = pendingToggleAction.editingItem;
                      const isEditMode = pendingToggleAction.isEditMode;

                      // Update service toggles
                      setServiceToggles((prev) => ({
                        ...prev,
                        [serviceKey]:
                          typeof newState === 'boolean' ? newState : newState === 'enabled',
                      }));

                      // If editing an anchor template item, update both editing item and the actual packetFilters item
                      if (isEditMode && editingItem?.type === 'anchor_template') {
                        // Update the editing item with proper anchor template format
                        setEditingItem((prev) => ({
                          ...prev,
                          content: {
                            ...prev.content,
                            type: 'anchor', // Ensure type is set
                            is_enabled: newState,
                          },
                          // Update the raw content based on the new state - use different file paths
                          raw: newState
                            ? `include "${prev.content?.enabled_file_path || ''}"`
                            : `include "${prev.content?.disabled_file_path || ''}"`,
                        }));

                        // Also immediately update the actual item in packetFilters to persist the change
                        setPacketFilters((prev) => ({
                          ...prev,
                          items: prev.items.map((item) =>
                            item.line === editingItem.line && item.type === 'anchor_template'
                              ? {
                                  ...item,
                                  content: {
                                    ...item.content,
                                    type: 'anchor',
                                    is_enabled: newState,
                                  },
                                  raw: newState
                                    ? `include "${item.content?.enabled_file_path || ''}"`
                                    : `include "${item.content?.disabled_file_path || ''}"`,
                                }
                              : item
                          ),
                        }));

                        // Mark that we have changes to save
                        setHasChanges(true);
                      } else {
                        // Only add new anchor template when NOT in edit mode
                        // Remove any existing rules for this service first
                        // Check both the toggle_type and content.toggle_type properties
                        setNewFilters((prev) =>
                          prev.filter((filter) => {
                            const filterToggleType =
                              filter.toggle_type || filter.content?.toggle_type;
                            return !filterToggleType || filterToggleType !== serviceKey;
                          })
                        );

                        // Create anchor template with proper format
                        // Get both TRUE and FALSE templates to extract both file paths
                        const trueTemplateKey = `PF_TOGGLE_${serviceKey.toUpperCase()}_TRUE`;
                        const falseTemplateKey = `PF_TOGGLE_${serviceKey.toUpperCase()}_FALSE`;
                        const trueTemplates = apiOptions.rule_templates[trueTemplateKey];
                        const falseTemplates = apiOptions.rule_templates[falseTemplateKey];

                        if (
                          trueTemplates &&
                          falseTemplates &&
                          Array.isArray(trueTemplates) &&
                          Array.isArray(falseTemplates)
                        ) {
                          // Extract file paths from both templates
                          const enabledFilePath =
                            trueTemplates[0]?.replace(/^#?include\s+"/, '').replace(/"$/, '') || '';
                          const disabledFilePath =
                            falseTemplates[0]?.replace(/^#?include\s+"/, '').replace(/"$/, '') ||
                            '';

                          // Use the appropriate template based on current state - only use the first template
                          const currentTemplate = newState ? trueTemplates[0] : falseTemplates[0];

                          const formData = {
                            type: 'anchor',
                            is_enabled: newState,
                            enabled_file_path: enabledFilePath,
                            disabled_file_path: disabledFilePath,
                            raw: currentTemplate.replace(/^#/, ''), // Remove hash to make commented includes active
                            toggle_type: serviceKey, // Add this to identify the rule
                          };
                          handleAddNewFilter('anchor_template', formData);
                        }
                      }
                    } else {
                      // Handle regular service toggle (existing logic)
                      if (editingItem && pendingToggleAction) {
                        const newToggleStates = [...(editingItem.content?.toggle_states || [])];
                        newToggleStates[pendingToggleAction.serviceIndex] =
                          pendingToggleAction.newState;

                        // Update the editing item
                        setEditingItem((prev) =>
                          prev
                            ? {
                                ...prev,
                                content: {
                                  ...prev.content,
                                  toggle_states: newToggleStates,
                                },
                              }
                            : null
                        );

                        setFormInteracted(true);
                      }
                    }
                  }

                  // Close the modal
                  setShowToggleConfirmation(false);
                  setPendingToggleAction(null);
                }}
                className={`px-4 py-2 text-sm text-white rounded transition-colors ${
                  pendingToggleAction.newState === 'enabled' ||
                  pendingToggleAction.newState === true
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {pendingToggleAction.newState === 'enabled' || pendingToggleAction.newState === true
                  ? 'Enable'
                  : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Payload Modal */}
      {debugModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Debug: Payload Preview</h3>
              <button
                onClick={() => setDebugModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                This is the exact payload that will be sent when you save:
              </p>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    const payload = constructDebugPayload();
                    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                    setFirewallNotification({
                      message: 'Payload copied to clipboard!',
                      type: 'success',
                    });
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => {
                    const payload = constructDebugPayload();
                    logger.info('Debug Payload:', payload);
                    setFirewallNotification({
                      message: 'Payload logged to console!',
                      type: 'success',
                    });
                  }}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Log to Console
                </button>
                <button
                  onClick={async () => {
                    try {
                      setIsGeneratingRules(true);
                      setGeneratedRules(null);
                      const payload = constructDebugPayload();
                      const rulesText = await generateFirewallRules(
                        selectedServer?.fqdn || selectedServer.ip,
                        payload,
                        dispatch
                      );
                      setGeneratedRules(rulesText);
                      setFirewallNotification({
                        message: 'Generated rules fetched successfully',
                        type: 'success',
                      });
                    } catch (err: any) {
                      logger.error('Failed to generate rules', { error: err });
                      setFirewallNotification({
                        message: err?.message || 'Failed to generate rules',
                        type: 'error',
                      });
                    } finally {
                      setIsGeneratingRules(false);
                    }
                  }}
                  disabled={isGeneratingRules}
                  className={`px-3 py-1 text-sm rounded text-white transition-colors ${isGeneratingRules ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {isGeneratingRules ? 'Generating…' : 'Generate Rules from Payload'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 h-[60vh]">
              {/* Left Column - Payload */}
              <div className="bg-gray-50 rounded-lg p-4 overflow-auto">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Debug Payload</h4>
                <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(constructDebugPayload(), null, 2)}
                </pre>
              </div>

              {/* Right Column - Generated Rules */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">Generated Rules</h4>
                  {generatedRules && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedRules);
                        setFirewallNotification({
                          message: 'Generated rules copied to clipboard!',
                          type: 'success',
                        });
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Copy Rules
                    </button>
                  )}
                </div>
                <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                  {generatedRules ||
                    'Click "Generate Rules from Payload" to see the output here...'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Preview Modal */}
      {rulePreviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Rule Preview - Review Before Saving
                {isEditingRules && (
                  <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    EDITING ENABLED
                  </span>
                )}
              </h3>
              <button
                onClick={() => {
                  setRulePreviewModalOpen(false);
                  setIsEditingRules(false);
                  setEditedRules('');
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                These are the firewall rules that will be applied to your server. You can edit them
                before applying:
              </p>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    if (!isEditingRules) {
                      const confirmEdit = window.confirm(
                        'You are about to edit the raw PF rules directly. This bypasses the form validation and requires knowledge of PF syntax.\n\n' +
                          'Are you sure you want to continue?'
                      );
                      if (!confirmEdit) return;
                    }
                    setIsEditingRules(!isEditingRules);
                  }}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  {isEditingRules ? 'Stop Editing' : 'Edit Rules'}
                </button>
                <button
                  onClick={() => {
                    setEditedRules(previewRules);
                    setFirewallNotification({
                      message: 'Rules reset to original!',
                      type: 'info',
                    });
                  }}
                  className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                >
                  Reset Changes
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[60vh]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-800">
                  Generated Firewall Rules
                  {isEditingRules && (
                    <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      EDITING MODE
                    </span>
                  )}
                </h4>
                {isEditingRules && (
                  <div className="text-xs text-gray-600">
                    Changes will be applied when you confirm
                  </div>
                )}
              </div>
              {isEditingRules ? (
                <textarea
                  value={editedRules}
                  onChange={(e) => setEditedRules(e.target.value)}
                  className="w-full h-[50vh] p-3 border border-gray-300 rounded font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Edit your firewall rules here..."
                  spellCheck={false}
                />
              ) : (
                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                  {previewRules || 'Generating rules...'}
                </pre>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setRulePreviewModalOpen(false);
                  setIsEditingRules(false);
                  setEditedRules('');
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => proceedWithSave()}
                disabled={isPreviewGenerating}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
              >
                {isPreviewGenerating ? 'Applying...' : 'Confirm & Apply Rules'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default ServerFirewall;

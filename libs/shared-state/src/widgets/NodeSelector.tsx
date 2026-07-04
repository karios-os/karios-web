import React from 'react';

interface Node {
  ip?: string;
  id?: string;
  uuid?: string;
  name?: string;
  hostname?: string;
}

interface NodeSelectorProps {
  availableNodes: Node[];
  selectedTargetNode: string;
  onNodeChange: (nodeId: string) => void;
  isLoadingNodes: boolean;
}

const NodeSelector: React.FC<NodeSelectorProps> = ({
  availableNodes,
  selectedTargetNode,
  onNodeChange,
  isLoadingNodes,
}) => {
  return (
    <div className="max-w-md">
      <select
        value={selectedTargetNode || ''}
        onChange={(e) => onNodeChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        disabled={isLoadingNodes}
      >
        <option value="">Select target node...</option>
        {availableNodes.map((node) => (
          <option key={node.ip || node.id || node.uuid} value={node.ip || node.id || node.uuid}>
            {node.name || node.hostname || node.ip} ({node.ip})
          </option>
        ))}
      </select>
      {selectedTargetNode && (
        <div className="mt-2 flex items-center text-sm text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Node selected successfully
        </div>
      )}
    </div>
  );
};

export default NodeSelector;

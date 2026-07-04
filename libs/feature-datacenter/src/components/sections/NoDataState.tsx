import React from 'react';

const NoDataState: React.FC = () => {
  return (
    <div className="p-6 bg-gray-50">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-4xl mx-auto">
        <p className="text-yellow-700 text-sm">No hardware inventory data available</p>
      </div>
    </div>
  );
};

export default NoDataState;

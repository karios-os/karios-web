import React from 'react';

interface NoServerSelectedStateProps {
  message?: string;
}

const NoServerSelectedState: React.FC<NoServerSelectedStateProps> = ({
  message = 'No server selected',
}) => {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">{message}</p>
    </div>
  );
};

export default NoServerSelectedState;

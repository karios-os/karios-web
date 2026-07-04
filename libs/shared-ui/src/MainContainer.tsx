import React from 'react';
import { Outlet } from 'react-router-dom';

interface MainContainerProps {
  children?: React.ReactNode;
  sidebarWidth?: number;
}

const MainContainer = ({ children, sidebarWidth = 32 }: MainContainerProps) => {
  const GAP_SIZE = 12; // 3mm gap between sidebar and content
  return (
    <div
      className="flex flex-col flex-1 w-full min-w-0 bg-white-50 overflow-hidden relative transition-all duration-500 ease-in-out"
      style={{
        marginLeft: `${sidebarWidth + GAP_SIZE}px`,
        width: `calc(100vw - ${sidebarWidth + GAP_SIZE}px)`,
      }}
    >
      {/* Main content area */}
      <div className={`flex-1 overflow-hidden p-4 pt-4`}>
        {React.createElement(Outlet as any)}
        {children}
      </div>
    </div>
  );
};

export default MainContainer;

import React from 'react';
import ApprovalsComponent from './ApprovalsComponent';

interface ApprovalsPageProps {
  host: string;
}

export default function ApprovalsPage({ host }: ApprovalsPageProps) {
  return <ApprovalsComponent host={host} />;
}

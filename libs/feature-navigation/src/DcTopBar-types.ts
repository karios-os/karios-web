// Define interfaces for DcTopBar component
export interface DataCenter {
  id: string;
  name: string;
  location?: string;
  nodes?: any[];
}

export interface DataCenterState {
  selectedDataCenter: DataCenter | null;
  currentDataCenterView: string;
  [key: string]: any;
}

export interface AppStateContext {
  state: DataCenterState;
  setDataCenterView: (view: string) => void;
  dispatch: React.Dispatch<any>;
}

export interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

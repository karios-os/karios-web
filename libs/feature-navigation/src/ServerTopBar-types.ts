// Define interfaces for ServerTopBar component
export interface Server {
  id: string;
  name: string;
  ip: string;
  fqdn?: string;
  hostname?: string;
  status?: string;
  vendor?: string;
}

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface ServerState {
  selectedServer: Server | null;
  currentServerView: string;
  [key: string]: any;
}

export interface AppStateContext {
  state: ServerState;
  setServerView: (view: string) => void;
}

// Define interfaces for TopNavBar component
export interface TopNavBarProps {
  // No props required for the component but interface is useful for future extensions
}

export interface NotificationProps {
  className?: string;
}

export interface NotificationDetail {
  version: string;
  components: string[];
  status: string;
  duration: string;
}

export interface NotificationItem {
  title: string;
  message: string;
  time: string;
  details: NotificationDetail;
}

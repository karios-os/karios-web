// Type declarations for @karios-monorepo/shared-ui
declare module '@karios-monorepo/shared-ui' {
  import React from 'react';

  export interface HomeProps {
    dataCenters: any[];
  }

  export interface ScrollableContentProps {
    children: React.ReactNode;
    className?: string;
    resetScrollOnRouteChange?: boolean;
    hasTopBar?: boolean;
    topBarHeight?: string;
    maxHeight?: string;
  }

  export type BreadcrumbItem = {
    label: string;
    onClick?: () => void;
    isActive?: boolean;
  };

  export interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    onBack?: () => void;
    className?: string;
    separator?: string;
    showBackButton?: boolean;
  }

  export const Home: React.FC<HomeProps>;
  export const ScrollableContent: React.FC<ScrollableContentProps>;
  export const Breadcrumbs: React.FC<BreadcrumbsProps>;
}

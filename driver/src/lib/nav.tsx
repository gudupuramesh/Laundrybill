/**
 * Tiny navigation context for the driver app — a bottom-tab selection plus a
 * push/pop stack of detail routes. Mirrors the owner app's lib-free navigator
 * pattern without pulling in react-navigation.
 */
import React, { createContext, useContext } from 'react';

export type TabKey =
  | 'today' | 'pickups' | 'scan' | 'deliveries' | 'profile'
  // Plant shell tabs
  | 'plantDashboard' | 'plantInbound' | 'plantProcessing' | 'plantReady' | 'plantProfile' | 'plantScan'
  // Staff shell tabs
  | 'staffOrders' | 'staffScan' | 'staffCreate' | 'staffCustomers' | 'staffProfile';

export type Route =
  | { name: 'pickupDetail'; orderId: string }
  | { name: 'deliveryDetail'; orderId: string }
  | { name: 'plantOrderDetail'; orderId: string }
  | { name: 'plantCompleted' }
  // Staff routes
  | { name: 'customerDetail'; customerId: string }
  | { name: 'addCustomer' }
  | { name: 'orderDetail'; orderId: string };

export interface Nav {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  stack: Route[];
  navigate: (route: Route) => void;
  goBack: () => boolean;
}

const NavContext = createContext<Nav | null>(null);

export const NavProvider = NavContext.Provider;

export function useNav(): Nav {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}

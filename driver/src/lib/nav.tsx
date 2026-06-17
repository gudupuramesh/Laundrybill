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
  | 'staffOrders' | 'staffScan' | 'staffCreate' | 'staffCustomers' | 'staffProfile'
  // Manager shell tabs
  | 'manHome' | 'manOrders' | 'manCustomers' | 'manFinance' | 'manProfile';

export type Route =
  | { name: 'pickupDetail'; orderId: string }
  | { name: 'deliveryDetail'; orderId: string }
  | { name: 'plantOrderDetail'; orderId: string }
  | { name: 'plantCompleted' }
  // Staff routes
  | { name: 'customerDetail'; customerId: string }
  | { name: 'addCustomer' }
  | { name: 'orderDetail'; orderId: string }
  // Manager-only overlay routes (reached from Home quick-actions or the Profile
  // settings menu). Finance/Expenses dashboard is a bottom tab (not here).
  | { name: 'managerAttendance' }
  | { name: 'managerScan' }
  | { name: 'managerExpenseList' }
  | { name: 'managerStaff' }
  | { name: 'managerStaffDetail'; staffId: string }
  | { name: 'managerCreateLogin'; prefill?: any }
  | { name: 'managerService' }
  | { name: 'managerItems'; categoryId: string; categoryName: string }
  | { name: 'managerTax' }
  | { name: 'managerServiceAreas' };

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

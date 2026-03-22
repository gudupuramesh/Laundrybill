/**
 * Pagination Constants
 * 
 * Centralized pagination settings for Firestore queries
 * Reduces read costs by limiting initial data fetch
 */

export const PAGINATION = {
    ORDERS_PER_PAGE: 20,
    CUSTOMERS_PER_PAGE: 30,
    STAFF_PER_PAGE: 50,
    EXPENSES_PER_PAGE: 30,
    INVENTORY_PER_PAGE: 50,
};

/**
 * Generate Staff Invite Code
 * 
 * Format: SHOPCODE-XXXXX
 * Example: FRSH-00001
 */

/**
 * Generates a unique invite code for a staff member
 * @param shopCode - The 4-character shop code (e.g., "FRSH")
 * @param staffCount - Current number of staff in the shop (for sequential numbering)
 * @returns Invite code in format "FRSH-00001"
 */
export function generateInviteCode(shopCode: string, staffCount: number): string {
    // Ensure shop code is uppercase and max 4 chars
    const code = shopCode.toUpperCase().slice(0, 4);

    // Generate sequential number with padding (5 digits)
    const sequenceNumber = (staffCount + 1).toString().padStart(5, '0');

    return `${code}-${sequenceNumber}`;
}

/**
 * Generates a randomized invite code for security
 * @param shopCode - The 4-character shop code
 * @returns Invite code in format "FRSH-12345"
 */
export function generateRandomInviteCode(shopCode: string): string {
    const code = shopCode.toUpperCase().slice(0, 4);
    // Generate random digit between 10000 and 99999
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `${code}-${randomNum}`;
}

/**
 * Validates if an invite code matches the expected format
 * @param code - The invite code to validate
 * @returns true if valid format
 */
export function isValidInviteCode(code: string): boolean {
    // Format: XXXX-XXXXX (4 alphanumeric chars - 5 digits)
    const regex = /^[A-Z0-9]{4}-\d{5}$/;
    return regex.test(code.toUpperCase());
}

/**
 * Extracts the shop code from an invite code
 * @param inviteCode - The full invite code
 * @returns The shop code portion
 */
export function extractShopCode(inviteCode: string): string {
    return inviteCode.split('-')[0].toUpperCase();
}

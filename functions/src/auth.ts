import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Exchange MSG91 verification for a Firebase Custom Token.
 * 
 * Flow:
 * 1. Frontend verifies phone with MSG91 Widget.
 * 2. Frontend calls this function with { phone }.
 * 3. We find/create Firebase User.
 * 4. We return custom token.
 * 
 * TODO: For higher security, verify the MSG91 transaction token server-side.
 */
export const loginWithMsg91 = onCall(async (request) => {
    // 1. Validate Input
    const { phone } = request.data;

    if (!phone) {
        throw new HttpsError("invalid-argument", "Phone number is required");
    }

    // Ensure phone format (E.164)
    // MSG91 might return various formats. We assume +91 or we add it.
    // The widget typically returns what was entered.
    // Let's sanitize.
    const cleanPhone = phone.replace(/\s+/g, "");
    const finalPhone = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;

    try {
        console.log(`[loginWithMsg91] Attempting login for ${finalPhone}`);

        // 2. Get or Create User
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByPhoneNumber(finalPhone);
            console.log(`[loginWithMsg91] Found existing user: ${userRecord.uid}`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.log(`[loginWithMsg91] Creating new user for ${finalPhone}`);
                userRecord = await admin.auth().createUser({
                    phoneNumber: finalPhone,
                    // We don't have email/name yet, that happens in onboarding
                });
            } else {
                throw error;
            }
        }

        // 3. Create Custom Token
        const customToken = await admin.auth().createCustomToken(userRecord.uid);

        console.log(`[loginWithMsg91] Token minted for ${userRecord.uid}`);

        return {
            token: customToken,
            uid: userRecord.uid,
            isNewUser: userRecord.metadata.creationTime === userRecord.metadata.lastSignInTime
        };

    } catch (error: any) {
        console.error("[loginWithMsg91] Error:", error);
        throw new HttpsError("internal", "Login failed: " + error.message);
    }
});

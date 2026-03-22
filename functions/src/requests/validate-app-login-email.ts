/**
 * Validate that an email belongs to a Staff / Agent / Plant app login before allowing password reset.
 * Called from Staff and Agent login "Forgot password" flows. Prevents sending reset links to shop owners
 * or other non-app-login emails.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

type AppType = "staff" | "agent";

interface RequestData {
  email: string;
  appType: AppType;
}

interface ResponseData {
  allowed: boolean;
}

export const validateAppLoginEmailForPasswordReset = onCall<RequestData, Promise<ResponseData>>(
  { enforceAppCheck: false },
  async (request): Promise<ResponseData> => {
    const data = request.data;
    if (!data || typeof data.email !== "string" || !data.email.trim()) {
      throw new HttpsError("invalid-argument", "Email is required.");
    }
    const appType = data.appType as AppType;
    if (appType !== "staff" && appType !== "agent") {
      throw new HttpsError("invalid-argument", "appType must be 'staff' or 'agent'.");
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { allowed: false };
    }

    const teamMembersRef = db.collectionGroup("teamMembers");
    const snapshot = await teamMembersRef
      .where("email", "==", normalizedEmail)
      .where("inviteStatus", "==", "accepted")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { allowed: false };
    }

    const doc = snapshot.docs[0];
    const memberType = doc.get("memberType") as string | undefined;

    if (appType === "staff") {
      return { allowed: memberType === "staff" || memberType === "plant" };
    }
    return { allowed: memberType === "agent" };
  }
);

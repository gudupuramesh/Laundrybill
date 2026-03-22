import { onRequest } from "firebase-functions/v2/https";
import { sendEmail } from "../services/zeptomail";

/**
 * HTTP Function to test ZeptoMail integration manually.
 * Usage: https://your-region-project.cloudfunctions.net/testEmail?email=your@email.com
 */
export const testEmail = onRequest(async (req, res) => {
    const email = req.query.email as string;

    if (!email) {
        res.status(400).send("Missing 'email' query parameter.");
        return;
    }

    try {
        const result = await sendEmail({
            to: [{ address: email, name: "Test User" }],
            subject: "ZeptoMail Integration Test",
            htmlBody: `
                <h1>It Works! 🎉</h1>
                <p>This is a test email from LaundryBoss via ZeptoMail.</p>
                <p>If you are seeing this, the integration is successful.</p>
            `,
        });

        if (result.success) {
            res.status(200).json({ message: "Email sent successfully", data: result.data });
        } else {
            res.status(500).json({ message: "Failed to send email", error: result.error });
        }
    } catch (error: any) {
        res.status(500).send(error.message);
    }
});

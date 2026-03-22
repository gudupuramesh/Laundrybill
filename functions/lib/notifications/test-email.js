"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const zeptomail_1 = require("../services/zeptomail");
/**
 * HTTP Function to test ZeptoMail integration manually.
 * Usage: https://your-region-project.cloudfunctions.net/testEmail?email=your@email.com
 */
exports.testEmail = (0, https_1.onRequest)(async (req, res) => {
    const email = req.query.email;
    if (!email) {
        res.status(400).send("Missing 'email' query parameter.");
        return;
    }
    try {
        const result = await (0, zeptomail_1.sendEmail)({
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
        }
        else {
            res.status(500).json({ message: "Failed to send email", error: result.error });
        }
    }
    catch (error) {
        res.status(500).send(error.message);
    }
});
//# sourceMappingURL=test-email.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const axios_1 = require("axios");
const ZEPTOMAIL_API_URL = "https://api.zeptomail.in/v1.1/email";
async function sendEmail({ to, subject, htmlBody }) {
    var _a, _b;
    const apiKey = process.env.ZEPTOMAIL_API_KEY;
    const senderEmail = process.env.ZEPTOMAIL_SENDER_EMAIL || "noreply@laundrybill.com";
    const senderName = process.env.ZEPTOMAIL_SENDER_NAME || "LaundryBoss";
    if (!apiKey) {
        console.error("ZEPTOMAIL_API_KEY is NOT properly configured.");
        return { success: false, error: "Missing API Key" };
    }
    try {
        const response = await axios_1.default.post(ZEPTOMAIL_API_URL, {
            from: {
                address: senderEmail,
                name: senderName,
            },
            to: to.map((recipient) => ({
                email_address: {
                    address: recipient.address,
                    name: recipient.name,
                },
            })),
            subject: subject,
            htmlbody: htmlBody,
        }, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": apiKey,
            },
        });
        console.log("Email sent successfully:", response.data);
        return { success: true, data: response.data };
    }
    catch (error) {
        console.error("ZeptoMail Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        return { success: false, error: ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message };
    }
}
exports.sendEmail = sendEmail;
//# sourceMappingURL=zeptomail.js.map
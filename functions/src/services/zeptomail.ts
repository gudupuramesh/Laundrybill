import axios from "axios";

const ZEPTOMAIL_API_URL = "https://api.zeptomail.in/v1.1/email";

interface EmailAddress {
    address: string;
    name?: string;
}

interface SendEmailOptions {
    to: EmailAddress[];
    subject: string;
    htmlBody: string;
    textBody?: string;
}

export async function sendEmail({ to, subject, htmlBody }: SendEmailOptions) {
    const apiKey = process.env.ZEPTOMAIL_API_KEY;
    const senderEmail = process.env.ZEPTOMAIL_SENDER_EMAIL || "noreply@laundrybill.com";
    const senderName = process.env.ZEPTOMAIL_SENDER_NAME || "LaundryBoss";

    if (!apiKey) {
        console.error("ZEPTOMAIL_API_KEY is NOT properly configured.");
        return { success: false, error: "Missing API Key" };
    }

    try {
        const response = await axios.post(
            ZEPTOMAIL_API_URL,
            {
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
            },
            {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": apiKey,
                },
            }
        );

        console.log("Email sent successfully:", response.data);
        return { success: true, data: response.data };
    } catch (error: any) {
        console.error("ZeptoMail Error:", error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

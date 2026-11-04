import { emailLayout, escapeHtml } from "./email-layout";

export function emailVerifiedTemplate(name: string) {
    const safeName = escapeHtml(name);

    return {
        subject: "Email Verified - Trip-Genie",
        html: emailLayout({
            title: "Email Successfully Verified",
            body: `<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Hi ${safeName},</p>
<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Your email address has been successfully verified! You now have full access to your Trip-Genie account.</p>
<p style="margin: 0 0 20px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">You can now start planning trips, generating custom itineraries, and exploring the world with ease.</p>
<p style="margin: 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Happy traveling!</p>`,
            buttonText: "Go to Dashboard",
            buttonUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/`,
        }),
        text: `Hi ${name},\n\nYour email address has been successfully verified! You now have full access to your Trip-Genie account.\n\nStart planning: ${process.env.APP_URL ?? "http://localhost:3000"}/`,
    };
}

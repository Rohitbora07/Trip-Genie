import { emailLayout, escapeHtml } from "./email-layout";

export function passwordChangedTemplate(name: string) {
    const safeName = escapeHtml(name);

    return {
        subject: "Your Password Has Been Changed - Trip-Genie",
        html: emailLayout({
            title: "Password Updated Successfully",
            body: `<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Hello ${safeName},</p>
<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Your Trip-Genie account password has been successfully updated.</p>
<p style="margin: 0 0 20px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">You can now log in using your new password. If you did not make this change, please contact our support team immediately.</p>`,
            buttonText: "Log In to Your Account",
            buttonUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/login`,
        }),
        text: `Hello ${name},\n\nYour Trip-Genie account password has been successfully updated.\n\nIf you did not make this change, please contact our support team immediately.\n\nLog in: ${process.env.APP_URL ?? "http://localhost:3000"}/login`,
    };
}

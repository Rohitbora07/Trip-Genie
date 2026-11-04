import { emailLayout, escapeHtml } from "./email-layout";

export function passwordResetTemplate(name: string, otp: string) {
    const safeName = escapeHtml(name);
    const safeOtp = escapeHtml(otp);

    return {
        subject: "Reset Your Password - Trip-Genie",
        html: emailLayout({
            title: "Password Reset Request",
            body: `<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Hello ${safeName},</p>
<p style="margin: 0 0 24px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">We received a request to reset your Trip-Genie account password. Please use the secure verification code provided below to complete the reset.</p>

<div style="margin: 35px 0; text-align: center;">
  <div style="display: inline-block; padding: 18px 40px; background-color: #FFF9C4; color: #C62828; font-size: 34px; font-weight: 700; letter-spacing: 8px; border-radius: 8px; font-family: 'Courier New', Courier, monospace; border: 1px solid #FFE082; box-shadow: 0 2px 8px rgba(255, 193, 7, 0.15);">${safeOtp}</div>
</div>

<p style="margin: 0 0 20px 0; color: #795548; font-size: 14px; line-height: 24px; text-align: center;">This one-time code is confidential and valid for <strong>10 minutes</strong>.</p>
<p style="margin: 0; color: #795548; font-size: 14px; line-height: 24px; text-align: center;">If you did not request this, you can safely ignore this email.</p>`,
        }),
        text: `Hello ${name},\n\nWe received a request to reset your password. Your secure code is: ${otp}\n\nThis one-time code is confidential and valid for 10 minutes.\n\nIf you did not initiate this request, please ignore this email.`,
    };
}

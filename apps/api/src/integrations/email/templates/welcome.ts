import { emailLayout, escapeHtml } from "./email-layout";

export function welcomeEmail(name: string) {
    const safeName = escapeHtml(name);

    return {
        subject: "Welcome to Trip-Genie!",
        html: emailLayout({
            title: "Welcome Aboard!",
            body: `<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Hi ${safeName},</p>
<p style="margin: 0 0 16px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Thanks for creating your Trip-Genie account. We're excited to help you plan smarter trips and handle unexpected travel disruptions with ease.</p>
<p style="margin: 0 0 20px 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Your next adventure starts right here. Dive in to start crafting your custom itineraries and mapping out your dream getaways.</p>
<p style="margin: 0; color: #2C3E50; font-size: 15px; line-height: 26px;">Happy traveling!</p>`,
            buttonText: "Explore Trip-Genie",
            buttonUrl: `${process.env.APP_URL}/`,
        }),
        text: `Hi ${name},\n\nWelcome to Trip-Genie! Thanks for creating an account. We're excited to help you plan smarter trips and handle travel disruptions seamlessly.\n\nExplore Trip-Genie: ${process.env.APP_URL}/`,
    };
}
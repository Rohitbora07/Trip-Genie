import {resend} from "./resend.client"

type SendEmailParams = {
    to: string;
    subject: string;
    html: string;
    text: string;
}

export async function sendEmail({ to, subject, html, text }: 
    SendEmailParams): Promise<{ id: string }> {
        const from = process.env.EMAIL_FROM as string;

        if( !from ) {
            throw new Error("EMAIL_FROM is not defined in the environment variables.")
        }

        const {data, error} = await resend.emails.send({
            from,
            to: 'rohitbora098@gmail.com',
            subject,
            html,
            text
        })

        if( error ){
            throw new Error(`Failed to send email: ${error.message}`);
        }

        if( !data || !data.id ) {
            throw new Error("Failed to send email: No response data received.");
        }
        console.log(`Email sent successfully. Email ID: ${data.id}`);
        return { id: data.id };
}
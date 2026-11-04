export function escapeHtml(value: string): string {
  if (value == null) return "";
  return value.toString().replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

type EmailLayoutInput = {
  title: string;
  body: string;
  buttonText?: string;
  buttonUrl?: string;
};

export function emailLayout({
  title,
  body,
  buttonText,
  buttonUrl,
}: EmailLayoutInput): string {
  const safeTitle = escapeHtml(title);

  // --- Bright, Airy Red, Orange & Sunny Yellow Palette ---
  const colors = {
    pageBg: "#FAF8F5",          // Very light, clean warm-white backdrop
    cardBg: "#FFFFFF",          // Pure white container card
    topBar: "#FF5722",          // Bright, energetic Sunset Orange top accent bar
    brandText: "#E64A19",       // Vibrant coral-red for brand name
    accentLine: "#FFC107",      // Bright Sunny Yellow divider line
    headingColor: "#C62828",    // Clean, bright coral-red for titles
    bodyText: "#2C3E50",        // Crispy, highly legible dark slate for text
    boxBg: "#FFF9C4",           // Soft, bright pale yellow tint for callout boxes
    boxBorder: "#FFE082",       // Warm golden-yellow border
    buttonBg: "#FF6F00",        // Vibrant, luminous bright orange-amber for CTA button
    buttonText: "#FFFFFF",      // Crisp white button text
    footerBg: "#FFFDE7",        // Bright, soft yellow cream footer background
    footerText: "#D84315",      // Warm orange-red accent for footer text
    supportText: "#795548",     // Clean, readable warm brown-grey for notes
  };

  // Bright, inviting CTA button
  const button =
    buttonText && buttonUrl
      ? `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;margin: 30px auto 0 auto;">
          <tr>
            <td align="center" bgcolor="${colors.buttonBg}" role="presentation" style="border:none;border-radius:8px;cursor:auto;mso-padding-alt:14px 28px;background:${colors.buttonBg};">
              <a href="${escapeHtml(
                buttonUrl
              )}" target="_blank" style="display:inline-block;background:${colors.buttonBg};color:${colors.buttonText};font-family:'Georgia', serif;font-size:16px;font-weight:bold;line-height:1.2;margin:0;text-decoration:none;text-transform:none;padding:16px 36px;mso-padding-alt:0px;border-radius:8px;">
                ${escapeHtml(buttonText)}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    table, td { border-collapse: collapse; }
    #outlook a { padding: 0; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: 0; height: auto; max-width: 100%; }
    
    .editorial-content h1, .editorial-content h2, .editorial-content h3 {
        font-family: 'Georgia', serif !important;
        color: ${colors.headingColor} !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.pageBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${colors.pageBg}; padding: 50px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container Card (560px width) -->
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${colors.cardBg}; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(255, 111, 0, 0.08); border: 1px solid ${colors.boxBorder};">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="background-color: ${colors.topBar}; height: 6px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header / Brand Section -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <span style="font-family:'Georgia', serif; font-size:24px; font-weight:700; color:${colors.brandText}; letter-spacing:-0.5px;">TRIP-GENIE</span>
              <div style="margin-top: 12px; width: 40px; height: 3px; background-color: ${colors.accentLine};"></div>
            </td>
          </tr>
          
          <!-- Main Body Content Section -->
          <tr>
            <td class="editorial-content" style="padding: 20px 40px 40px 40px;">
              <h2 style="margin: 0 0 16px 0; color: ${colors.headingColor}; font-family: 'Georgia', serif; font-size: 24px; font-weight: 600; line-height: 1.3;">${safeTitle}</h2>
              
              <div style="font-size: 15px; line-height: 26px; color: ${colors.bodyText}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${body}
              </div>

              <!-- Centered CTA Button if provided -->
              ${button ? `<div style="text-align: center;">${button}</div>` : ""}
              
              <!-- Security / Helper Note Box -->
              <div style="margin-top: 35px; padding: 20px; background-color: ${colors.boxBg}; border: 1px solid ${colors.boxBorder}; border-radius: 6px;">
                <p style="margin: 0; color: ${colors.supportText}; font-size: 13px; line-height: 22px;"><strong>Security & Support Note:</strong> If you did not initiate this request or expect this email, you can safely ignore it or contact our support team.</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer Section -->
          <tr>
            <td style="padding: 30px 40px; background-color: ${colors.footerBg}; border-top: 1px solid ${colors.boxBorder};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="color: ${colors.footerText}; font-size: 13px; line-height: 20px; font-weight: 500;">Questions? Contact our support team by replying directly to this email.</td>
                </tr>
                <tr>
                  <td style="padding-top: 16px; color: #8D6E63; font-size: 12px; line-height: 18px;">&copy; ${new Date().getFullYear()} Trip-Genie. All rights reserved.<br/>This is an automated notification.</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
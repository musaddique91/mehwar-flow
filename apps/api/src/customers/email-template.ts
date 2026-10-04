export interface PlatformLink {
  platform: string;
  label: string;
  url: string;
  channelName: string;
}

export interface RenderEmailOptions {
  customerName: string;
  postText?: string;
  customMessage?: string;
  thumbnailUrl?: string | null;
  links: PlatformLink[];
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; iconBg: string }> = {
  youtube: { bg: '#FF0000', text: '#FFFFFF', iconBg: '#CC0000' },
  linkedin: { bg: '#0A66C2', text: '#FFFFFF', iconBg: '#084E96' },
  facebook: { bg: '#1877F2', text: '#FFFFFF', iconBg: '#0C5DC7' },
  instagram: { bg: '#E4405F', text: '#FFFFFF', iconBg: '#C13584' },
  x: { bg: '#0F1419', text: '#FFFFFF', iconBg: '#000000' },
  threads: { bg: '#101010', text: '#FFFFFF', iconBg: '#000000' },
  tiktok: { bg: '#000000', text: '#00F2FE', iconBg: '#111111' },
};

export function renderCustomerShareEmail({
  customerName,
  postText,
  customMessage,
  thumbnailUrl,
  links,
}: RenderEmailOptions): { html: string; text: string } {
  const safeName = customerName || 'there';
  const displayPostText = postText ? postText.replace(/\n/g, '<br>') : '';
  const displayCustomMsg = customMessage ? customMessage.replace(/\n/g, '<br>') : '';

  const linksHtml = links
    .map((l) => {
      const colors = PLATFORM_COLORS[l.platform.toLowerCase()] || { bg: '#8B5CF6', text: '#FFFFFF', iconBg: '#7C3AED' };
      return `
        <tr style="border-collapse: collapse;">
          <td style="padding: 12px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
              <tr>
                <td style="padding: 16px;">
                  <div style="font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    ${l.label}
                  </div>
                  <div style="font-size: 14px; color: #1e293b; font-weight: 600; margin-bottom: 12px;">
                    ${l.channelName}
                  </div>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-radius: 8px; background-color: ${colors.bg};">
                        <a href="${l.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: bold; color: ${colors.text}; text-decoration: none; border-radius: 8px;">
                          Watch on ${l.label} &rarr;
                        </a>
                      </td>
                      <td style="padding-left: 12px;">
                        <a href="${l.url}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: #64748b; text-decoration: underline; word-break: break-all;">
                          ${l.url}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Video & Update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <!-- Top Gradient Bar -->
          <tr>
            <td style="height: 8px; background: linear-gradient(120deg, #8b5cf6, #d946ef 50%, #f97316);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 18px; font-weight: 900; background: linear-gradient(120deg, #8b5cf6, #d946ef 50%, #f97316); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                      Mehwar Flow
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 16px 0 8px 0; letter-spacing: -0.5px;">
                New Video & Social Update
              </h1>
              <p style="font-size: 15px; color: #64748b; margin: 0 0 16px 0; line-height: 1.5;">
                Hi <strong>${safeName}</strong>, we just published a new video and wanted to share the direct links with you!
              </p>
            </td>
          </tr>

          ${
            displayCustomMsg
              ? `
          <!-- Custom Message Note -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <div style="background-color: #fdf4ff; border-left: 4px solid #d946ef; padding: 14px 18px; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #86198f; font-weight: 500; line-height: 1.5;">
                  ${displayCustomMsg}
                </p>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          ${
            thumbnailUrl
              ? `
          <!-- Video Thumbnail -->
          <tr>
            <td style="padding: 0 32px 20px 32px;" align="center">
              <img src="${thumbnailUrl}" alt="Video Preview" style="width: 100%; max-height: 280px; object-fit: cover; border-radius: 12px; border: 1px solid #e2e8f0; display: block;" />
            </td>
          </tr>
          `
              : ''
          }

          ${
            displayPostText
              ? `
          <!-- Post Summary -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 14px; color: #334155; line-height: 1.6;">
                ${displayPostText}
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Watch Links Section -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                Watch on Your Favorite Platform:
              </div>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                ${linksHtml}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; font-weight: 500;">
                Sent directly to you via Mehwar Flow
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                If you have questions or wish to update your preferences, feel free to reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textLinks = links.map((l) => `${l.label} (${l.channelName}):\n${l.url}\n`).join('\n');
  const text = `Hi ${safeName},\n\nWe just published a new video!\n\n${customMessage ? `${customMessage}\n\n` : ''}${postText ? `${postText}\n\n` : ''}Watch now:\n\n${textLinks}\nSent via Mehwar Flow`;

  return { html, text };
}

export function formatWhatsAppMessage({
  customerName,
  postText,
  customMessage,
  links,
}: Omit<RenderEmailOptions, 'thumbnailUrl'>): string {
  const parts: string[] = [];

  parts.push(`*🎬 New Video & Update from Mehwar Flow*`);
  if (customerName) parts.push(`Hi ${customerName}! 👋`);

  if (customMessage) {
    parts.push(`\n💬 *Note:*\n${customMessage.trim()}`);
  }

  if (postText) {
    // Trim excerpt if long
    const excerpt = postText.length > 300 ? postText.slice(0, 297) + '...' : postText;
    parts.push(`\n📝 *Description:*\n${excerpt.trim()}`);
  }

  if (links.length > 0) {
    parts.push(`\n🔗 *Watch Now:*`);
    for (const l of links) {
      parts.push(`▶️ *${l.label}*: ${l.url}`);
    }
  }

  parts.push(`\n_Sent via Mehwar Flow_`);
  return parts.join('\n');
}

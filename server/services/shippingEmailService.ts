import path from "path";
import fs from "fs/promises";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function resolveLabelAttachment(labelUrl: string): Promise<{
  filename: string;
  content: Buffer;
} | null> {
  try {
    if (labelUrl.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), labelUrl.replace(/^\//, ""));
      const content = await fs.readFile(filePath);
      return { filename: path.basename(filePath), content };
    }
    if (labelUrl.startsWith("http://") || labelUrl.startsWith("https://")) {
      const res = await fetch(labelUrl);
      if (!res.ok) return null;
      const content = Buffer.from(await res.arrayBuffer());
      return { filename: "shipping-label.pdf", content };
    }
  } catch {
    return null;
  }
  return null;
}

export async function sendShippingLabelEmail(input: {
  email: string;
  labelUrl: string;
  trackingNumber: string;
}): Promise<{ mock: boolean; message: string }> {
  const to = input.email.trim();
  if (!isEmail(to)) {
    throw new Error("Enter a valid email address.");
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const from =
    process.env.SMTP_FROM?.trim() || smtpUser || "noreply@kauf26.local";

  const attachment = await resolveLabelAttachment(input.labelUrl);

  if (!smtpHost) {
    console.log(
      `[ShippingEmail] mock send to=${to} tracking=${input.trackingNumber} label=${input.labelUrl}`
    );
    return {
      mock: true,
      message: "Email logged (configure SMTP_HOST in .env to send real mail).",
    };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transporter.sendMail({
    from,
    to,
    subject: `Shipping label — tracking ${input.trackingNumber}`,
    text: `Your shipping label is attached.\nTracking: ${input.trackingNumber}\n`,
    attachments: attachment
      ? [{ filename: attachment.filename, content: attachment.content }]
      : [],
  });

  return { mock: false, message: `Label emailed to ${to}.` };
}

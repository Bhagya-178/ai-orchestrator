"""
Email notification and OTP verification dispatch service.

Supports production SMTP delivery (STARTTLS / SSL) with automatic fallback
to formatted console banners in local development environments.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Handles dispatching verification and notification emails."""

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or (self.user if self.user else "noreply@ai-orchestrator.local")
        self.from_name = settings.SMTP_FROM_NAME or "AI Orchestrator"
        self.use_tls = settings.SMTP_TLS

    def is_smtp_configured(self) -> bool:
        """Check if SMTP credentials are configured for real email delivery."""
        return bool(self.host and self.host.strip())

    def _format_otp_html(self, to_email: str, otp_code: str, full_name: str = "") -> str:
        name_greeting = f"Hello {full_name}," if full_name else "Hello,"
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 500px;
            margin: 0 auto;
            background: #1e293b;
            border-radius: 16px;
            padding: 32px;
            border: 1px solid #334155;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }}
        .logo {{
            font-size: 20px;
            font-weight: 700;
            color: #38bdf8;
            margin-bottom: 24px;
        }}
        h1 {{
            font-size: 22px;
            font-weight: 600;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 12px;
        }}
        p {{
            font-size: 14px;
            line-height: 1.6;
            color: #94a3b8;
            margin-bottom: 24px;
        }}
        .otp-box {{
            background: #0f172a;
            border: 2px dashed #0284c7;
            border-radius: 12px;
            padding: 18px 24px;
            text-align: center;
            letter-spacing: 8px;
            font-size: 32px;
            font-weight: 800;
            color: #38bdf8;
            margin-bottom: 24px;
        }}
        .footer {{
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #334155;
            padding-top: 16px;
            margin-top: 24px;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">✦ {self.from_name}</div>
        <h1>Email Verification Code</h1>
        <p>{name_greeting}</p>
        <p>Use the 6-digit confirmation code below to complete your registration. This code expires in <strong>10 minutes</strong>.</p>
        <div class="otp-box">{otp_code}</div>
        <p>If you didn't request this code, you can safely ignore this email.</p>
        <div class="footer">
            &copy; AI Orchestrator Enterprise Platform. All rights reserved.
        </div>
    </div>
</body>
</html>"""

    def _format_otp_plain(self, to_email: str, otp_code: str, full_name: str = "") -> str:
        name_greeting = f"Hello {full_name}," if full_name else "Hello,"
        return f"""{name_greeting}

Your verification code for {self.from_name} is:

    {otp_code}

This code will expire in 10 minutes.
If you did not request this verification code, please ignore this email.
"""

    def _send_smtp_sync(self, to_email: str, subject: str, plain_text: str, html_content: str) -> bool:
        """Synchronous SMTP delivery executed inside an asyncio worker thread."""
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email
            msg.set_content(plain_text)
            msg.add_alternative(html_content, subtype="html")

            if self.port == 465:
                with smtplib.SMTP_SSL(self.host, self.port, timeout=10) as server:
                    if self.user and self.password:
                        server.login(self.user, self.password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                    server.ehlo()
                    if self.use_tls:
                        server.starttls()
                        server.ehlo()
                    if self.user and self.password:
                        server.login(self.user, self.password)
                    server.send_message(msg)

            logger.info("Sent verification email via SMTP to %s", to_email)
            return True
        except Exception as e:
            logger.error("Failed to deliver email via SMTP to %s: %s", to_email, e)
            return False

    async def send_otp_email(self, to_email: str, otp_code: str, full_name: str = "") -> bool:
        """
        Deliver a 6-digit OTP verification email.
        If SMTP is configured, sends via SMTP asynchronously.
        If SMTP is not configured, logs a high-visibility terminal banner for local development.
        """
        subject = f"{otp_code} is your {self.from_name} verification code"
        plain_text = self._format_otp_plain(to_email, otp_code, full_name)
        html_content = self._format_otp_html(to_email, otp_code, full_name)

        if self.is_smtp_configured():
            return await asyncio.to_thread(self._send_smtp_sync, to_email, subject, plain_text, html_content)

        banner = f"""
======================================================================
>>> [EMAIL VERIFICATION OTP]
----------------------------------------------------------------------
To:                {to_email}
Full Name:         {full_name or 'N/A'}
Verification Code: {otp_code}
Expires in:        {settings.OTP_EXPIRE_MINUTES} minutes
Status:            Logged to console (SMTP not configured)
Hint:              Configure SMTP_HOST in .env for real email delivery
======================================================================
"""
        try:
            print(banner, flush=True)
        except Exception:
            pass
        logger.info("Development OTP generated for %s: %s", to_email, otp_code)
        return True


email_service = EmailService()

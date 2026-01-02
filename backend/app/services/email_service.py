"""
Email service for sending emails via SendGrid
"""
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import os


class EmailService:
    """Service class for handling email operations"""

    @staticmethod
    def _getContent(name: str, email: str, message: str):

        # Construct email content
        subject = f"Portfolio Contact: Message from {name}"
        body = f"""
        <html>
            <body>
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> {name}</p>
                <p><strong>Email:</strong> {email}</p>
                <p><strong>Message:</strong></p>
                <p>{message}</p>
            </body>
        </html>
        """
        return subject, body

    @staticmethod
    def sendEmail(fromEmail: str, name: str, email: str, message: str):
        """
        Send email via SendGrid

        Args:
            fromEmail (str): Sender's email address (reply-to address)
            subject (str): Email subject
            body (str): Email body (HTML content)

        Returns:
            tuple: (success: bool, error_message: str or None)
        """
        # Get environment variables
        sendgridApiKey = os.getenv('SENDGRID_API_KEY')
        sendgridFromEmail = os.getenv('SENDGRID_FROM_EMAIL')
        toEmail = os.getenv('CONTACT_EMAIL')

        # Validate configuration
        if not sendgridApiKey or sendgridApiKey == 'your-sendgrid-api-key-here':
            return (False, 'SendGrid API key not configured')

        if not sendgridFromEmail or not toEmail:
            return (False, 'Email addresses not configured')

        subject, body = EmailService._getContent(name, email, message)

        # Create and send email
        try:
            mailMessage = Mail(
                from_email=sendgridFromEmail,
                to_emails=toEmail,
                subject=subject,
                html_content=body
            )

            # Set reply-to to the sender's email
            mailMessage.reply_to = fromEmail

            sg = SendGridAPIClient(sendgridApiKey)
            sg.send(mailMessage)

            return (True, None)

        except Exception as e:
            # Log error (in production, use proper logging)
            print(f"Email sending error: {str(e)}")
            return (False, str(e))

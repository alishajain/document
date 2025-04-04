const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendDocumentLink = async (toEmail, documentUrl, expiresAt) => {
  try {
    const mailOptions = {
      from: `"Document Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Shared Document Link',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Document Shared With You</h2>
          <p>You've been granted access to a document in our Document Management System.</p>
          <p><strong>Important:</strong> This link will expire at ${expiresAt.toLocaleString()}.</p>
          <p>Click the button below to view the document:</p>
          <a href="${documentUrl}" 
             style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
            View Document
          </a>
          <p style="margin-top: 20px;">If the button doesn't work, copy and paste this URL into your browser:</p>
          <p>${documentUrl}</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
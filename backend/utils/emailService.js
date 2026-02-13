// Simple email service - you can integrate with SendGrid, AWS SES, etc.
import nodemailer from "nodemailer";

class EmailService {
  constructor() {
    // Configure your email service here
    this.transporter = nodemailer.createTransport({
      // Example for Gmail:
      // service: 'gmail',
      // auth: {
      //   user: process.env.EMAIL_USER,
      //   pass: process.env.EMAIL_PASS
      // }
      
      // For development/testing, use ethereal.email
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@example.com',
        pass: process.env.EMAIL_PASS || 'your-password'
      }
    });
  }

  async sendEmail(options) {
    const { to, subject, text, html, icalEvent } = options;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'EMS System <noreply@ems.com>',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text,
      html
    };

    // Add calendar invite if provided
    if (icalEvent) {
      mailOptions.icalEvent = {
        filename: 'invite.ics',
        content: icalEvent,
        method: 'REQUEST'
      };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMeetingInvite(meeting, attendees) {
    const meetingDate = new Date(meeting.meetingDateTime).toLocaleString();
    const endTime = new Date(meeting.meetingDateTime);
    endTime.setMinutes(endTime.getMinutes() + meeting.duration);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Meeting Invitation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #3b82f6; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px; 
              font-weight: bold;
              margin: 10px 5px;
            }
            .details { margin: 20px 0; }
            .detail-item { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Meeting Invitation</h1>
            </div>
            <div class="content">
              <h2>${meeting.title}</h2>
              
              <div class="details">
                <div class="detail-item"><strong>📅 Date & Time:</strong> ${meetingDate}</div>
                <div class="detail-item"><strong>⏱️ Duration:</strong> ${meeting.duration} minutes</div>
                <div class="detail-item"><strong>📍 Location:</strong> ${meeting.meetingLink || 'Virtual Meeting'}</div>
                ${meeting.agenda ? `<div class="detail-item"><strong>📋 Agenda:</strong><br>${meeting.agenda}</div>` : ''}
                ${meeting.description ? `<div class="detail-item"><strong>📝 Description:</strong><br>${meeting.description}</div>` : ''}
              </div>
              
              <div style="margin: 30px 0;">
                <a href="${meeting.meetingLink || '#'}" class="button">🎯 Join Meeting</a>
                <a href="${process.env.FRONTEND_URL}/meetings/${meeting._id}/rsvp?status=accepted" class="button" style="background: #10b981;">✅ Accept</a>
                <a href="${process.env.FRONTEND_URL}/meetings/${meeting._id}/rsvp?status=declined" class="button" style="background: #ef4444;">❌ Decline</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                This meeting was scheduled using EMS (Employee Management System). 
                Please add this event to your calendar.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Meeting Invitation: ${meeting.title}
      
      Date & Time: ${meetingDate}
      Duration: ${meeting.duration} minutes
      Location: ${meeting.meetingLink || 'Virtual Meeting'}
      
      ${meeting.agenda ? `Agenda: ${meeting.agenda}\n` : ''}
      ${meeting.description ? `Description: ${meeting.description}\n` : ''}
      
      Join Meeting: ${meeting.meetingLink}
      Accept: ${process.env.FRONTEND_URL}/meetings/${meeting._id}/rsvp?status=accepted
      Decline: ${process.env.FRONTEND_URL}/meetings/${meeting._id}/rsvp?status=declined
      
      This meeting was scheduled using EMS (Employee Management System).
    `;

    const results = [];
    for (const attendee of attendees) {
      const result = await this.sendEmail({
        to: attendee.email,
        subject: `Meeting Invitation: ${meeting.title}`,
        text,
        html
      });
      results.push({ attendee: attendee.email, ...result });
    }

    return results;
  }

  async sendMeetingReminder(meeting, attendee, minutesBefore) {
    const meetingDate = new Date(meeting.meetingDateTime).toLocaleString();
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Meeting Reminder</title>
        </head>
        <body>
          <h2>⏰ Meeting Reminder</h2>
          <p>Your meeting <strong>"${meeting.title}"</strong> starts in ${minutesBefore} minutes.</p>
          <p><strong>Time:</strong> ${meetingDate}</p>
          <p><strong>Link:</strong> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></p>
          <br>
          <p>Best regards,<br>EMS System</p>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: attendee.email,
      subject: `Reminder: "${meeting.title}" in ${minutesBefore} minutes`,
      text: `Reminder: Your meeting "${meeting.title}" starts in ${minutesBefore} minutes at ${meetingDate}. Join here: ${meeting.meetingLink}`,
      html
    });
  }

  async sendActionItemNotification(actionItem, assignee) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Action Item Assigned</title>
        </head>
        <body>
          <h2>✅ New Action Item Assigned</h2>
          <p>You have been assigned a new action item:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p><strong>Description:</strong> ${actionItem.description}</p>
            ${actionItem.dueDate ? `<p><strong>Due Date:</strong> ${new Date(actionItem.dueDate).toLocaleDateString()}</p>` : ''}
            <p><strong>Priority:</strong> <span style="color: ${getPriorityColor(actionItem.priority)}">${actionItem.priority.toUpperCase()}</span></p>
          </div>
          <br>
          <p>View details in EMS System.</p>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: assignee.email,
      subject: `New Action Item: ${actionItem.description.substring(0, 50)}${actionItem.description.length > 50 ? '...' : ''}`,
      text: `New Action Item Assigned:\n\nDescription: ${actionItem.description}\n${actionItem.dueDate ? `Due Date: ${new Date(actionItem.dueDate).toLocaleDateString()}\n` : ''}Priority: ${actionItem.priority}\n\nView in EMS System.`,
      html
    });
  }
}

function getPriorityColor(priority) {
  const colors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626'
  };
  return colors[priority] || '#6b7280';
}

// Export singleton instance
export const emailService = new EmailService();

// Export individual functions for convenience
export const sendEmail = (options) => emailService.sendEmail(options);
export const sendMeetingInvite = (meeting, attendees) => emailService.sendMeetingInvite(meeting, attendees);
export const sendMeetingReminder = (meeting, attendee, minutesBefore) => emailService.sendMeetingReminder(meeting, attendee, minutesBefore);
export const sendActionItemNotification = (actionItem, assignee) => emailService.sendActionItemNotification(actionItem, assignee);
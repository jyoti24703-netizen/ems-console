// Calendar service for generating iCal files and calendar integration
import ics from 'ics';

class CalendarService {
  generateICalEvent(eventData) {
    const {
      title,
      description = '',
      start,
      end,
      location = '',
      organizer = { name: 'EMS System', email: 'noreply@ems.com' },
      attendees = [],
      uid,
      sequence = 0,
      status = 'CONFIRMED'
    } = eventData;

    // Format start and end times for ics library
    const startDate = new Date(start);
    const endDate = new Date(end);

    const event = {
      start: [
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        startDate.getDate(),
        startDate.getHours(),
        startDate.getMinutes()
      ],
      end: [
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        endDate.getDate(),
        endDate.getHours(),
        endDate.getMinutes()
      ],
      title,
      description,
      location,
      organizer: {
        name: organizer.name,
        email: organizer.email
      },
      attendees: attendees.map(attendee => ({
        name: attendee.name || attendee.email,
        email: attendee.email,
        rsvp: true,
        partstat: 'NEEDS-ACTION',
        role: 'REQ-PARTICIPANT'
      })),
      uid: uid || `meeting-${Date.now()}@ems.com`,
      sequence,
      status,
      busyStatus: 'BUSY',
      alarms: [
        {
          action: 'display',
          description: 'Reminder',
          trigger: { hours: 0, minutes: 15, before: true }
        }
      ]
    };

    const { error, value } = ics.createEvent(event);
    
    if (error) {
      console.error('Error creating iCal event:', error);
      throw new Error('Failed to generate calendar event');
    }

    return value;
  }

  generateGoogleCalendarLink(meeting) {
    const startTime = encodeURIComponent(new Date(meeting.meetingDateTime).toISOString());
    const endTime = new Date(meeting.meetingDateTime);
    endTime.setMinutes(endTime.getMinutes() + meeting.duration);
    const endTimeEncoded = encodeURIComponent(endTime.toISOString());
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: meeting.title,
      details: meeting.description || '',
      location: meeting.meetingLink || '',
      dates: `${startTime}/${endTimeEncoded}`,
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  generateOutlookCalendarLink(meeting) {
    const startTime = new Date(meeting.meetingDateTime);
    const endTime = new Date(meeting.meetingDateTime);
    endTime.setMinutes(endTime.getMinutes() + meeting.duration);
    
    // Format for Outlook: YYYY-MM-DDTHH:MM:SS
    const formatDateTime = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: meeting.title,
      body: meeting.description || '',
      location: meeting.meetingLink || '',
      startdt: formatDateTime(startTime),
      enddt: formatDateTime(endTime),
      allday: 'false'
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  generateAppleCalendarLink(meeting) {
    const startTime = new Date(meeting.meetingDateTime);
    const endTime = new Date(meeting.meetingDateTime);
    endTime.setMinutes(endTime.getMinutes() + meeting.duration);
    
    // Apple Calendar uses webcal:// protocol with .ics file
    // This would typically be used with a downloadable .ics file
    // For now, we'll provide instructions
    
    return {
      instructions: 'Download the .ics file and import into Apple Calendar',
      protocol: 'webcal',
      requiresDownload: true
    };
  }

  generateCalendarLinks(meeting) {
    return {
      google: this.generateGoogleCalendarLink(meeting),
      outlook: this.generateOutlookCalendarLink(meeting),
      apple: this.generateAppleCalendarLink(meeting),
      ical: this.generateICalEvent({
        title: meeting.title,
        description: meeting.description || '',
        start: meeting.meetingDateTime,
        end: new Date(new Date(meeting.meetingDateTime).getTime() + meeting.duration * 60000),
        location: meeting.meetingLink || '',
        organizer: {
          name: meeting.organizer?.name || 'EMS System',
          email: meeting.organizer?.email || 'noreply@ems.com'
        },
        attendees: meeting.attendees?.map(a => ({
          name: a.employee?.name || '',
          email: a.employee?.email || ''
        })) || []
      })
    };
  }

  // Generate meeting recurrence rule
  generateRecurrenceRule(recurrencePattern, endDate = null) {
    const rules = {
      daily: 'FREQ=DAILY',
      weekly: 'FREQ=WEEKLY',
      monthly: 'FREQ=MONTHLY'
    };

    if (!rules[recurrencePattern]) {
      return '';
    }

    let rule = rules[recurrencePattern];
    
    if (endDate) {
      const formattedEndDate = endDate.toISOString().replace(/-/g, '').replace(/:/g, '').split('.')[0] + 'Z';
      rule += `;UNTIL=${formattedEndDate}`;
    }

    return rule;
  }

  // Parse iCal date string
  parseICalDate(dateString) {
    // Basic iCal date parsing (simplified)
    if (dateString.includes('T')) {
      return new Date(dateString.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
    }
    return new Date(dateString);
  }
}

// Export singleton instance
export const calendarService = new CalendarService();

// Export individual functions for convenience
export const generateICal = (eventData) => calendarService.generateICalEvent(eventData);
export const generateCalendarLinks = (meeting) => calendarService.generateCalendarLinks(meeting);
export const generateRecurrenceRule = (pattern, endDate) => calendarService.generateRecurrenceRule(pattern, endDate);
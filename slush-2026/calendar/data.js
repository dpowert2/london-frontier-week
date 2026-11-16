/* Slush week, 16–20 November 2026. Same shape as the London Frontier Week data file.
   All times are Helsinki time. */
window.FRONTIER_DATA = {
  meta: {
    title: 'Slush week',
    subtitle: '16–20 November 2026, Helsinki',
    source: 'Built from calendar, travel and event screenshots shared on 16 November. All times are Helsinki time, which is two hours ahead of Dublin and one hour ahead of Copenhagen.',
    updated: '16 November 2026',
    timezone: 'Europe/Helsinki'
  },

  days: [
    { id: 'mon', label: 'Monday',    short: 'Mon', date: '2026-11-16', num: '16' },
    { id: 'tue', label: 'Tuesday',   short: 'Tue', date: '2026-11-17', num: '17' },
    { id: 'wed', label: 'Wednesday', short: 'Wed', date: '2026-11-18', num: '18' },
    { id: 'thu', label: 'Thursday',  short: 'Thu', date: '2026-11-19', num: '19' },
    { id: 'fri', label: 'Friday',    short: 'Fri', date: '2026-11-20', num: '20' }
  ],

  hotels: {},

  people: [
    { id: 'david', name: 'David Power', org: 'FCAT Europe', group: 'fidelity', hotel: null,
      role: 'Director, Innovation Ecosystem Europe', bio: '', url: 'https://www.linkedin.com/in/dapower' }
  ],

  events: [
    /* Monday */
    { id: 'mon-flight-1', day: 'mon', start: '14:30', end: '16:35', kind: 'personal', status: 'confirmed',
      title: 'Flight SK538, Dublin to Copenhagen', short: 'SK538', venue: 'Dublin Airport', area: 'Travel',
      description: 'Departs Dublin 12:30 local time. Lands Copenhagen 15:35 local time.',
      notes: 'Shown here in Helsinki time.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'mon-builders', day: 'mon', start: '17:00', end: '17:30', kind: 'session', status: 'confirmed',
      title: 'Builders of Builders', short: 'Builders', venue: 'Online', area: 'Online',
      description: 'Online session. 16:00 to 16:30 Copenhagen time, so take it at the gate between flights.',
      actions: [], attendees: ['david'], tbc: [] },
    { id: 'mon-flight-2', day: 'mon', start: '18:40', end: '20:20', kind: 'personal', status: 'confirmed',
      title: 'Flight SK1716, Copenhagen to Helsinki', short: 'SK1716', venue: 'Copenhagen Airport', area: 'Travel',
      description: 'Departs Copenhagen 17:40 local time. Lands Helsinki 20:20.',
      actions: [], attendees: ['david'], tbc: [] },

    /* Tuesday */
    { id: 'tue-espoo', day: 'tue', start: '08:40', end: '13:00', kind: 'session', status: 'confirmed',
      title: 'Espoo Innovation Day', short: 'Espoo', venue: 'Espoo', area: 'Espoo',
      description: 'Morning programme in Espoo.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'tue-fellows', day: 'tue', start: '18:00', end: '21:00', kind: 'social', status: 'tbc', timeTbc: true,
      title: 'Fellow Networking', short: 'Fellows', venue: 'Venue TBC',
      description: 'Ends at 21:00. The start time is not confirmed, so 18:00 is a placeholder.',
      actions: ['Confirm start time and venue'], attendees: [], tbc: ['david'] },
    { id: 'tue-partner-dinner', day: 'tue', start: '19:00', end: '23:00', kind: 'social', status: 'tbc', timeTbc: true,
      title: 'Slush Partner Dinner', short: 'Partner dinner', venue: 'Sipuli', address: 'Kanavaranta 7, Helsinki',
      description: 'Ends at 23:00. Cocktail dress. One seat, for you or a colleague. The start time is not confirmed, so 19:00 is a placeholder.',
      actions: ['Decide who takes the seat', 'Confirm start time'], attendees: [], tbc: ['david'] },
    { id: 'tue-hoku', day: 'tue', start: '21:00', end: null, kind: 'social', status: 'tbc', timeTbc: true,
      title: 'Hoku (optional)', short: 'Hoku', venue: 'Hoku',
      description: 'Optional. Time not confirmed.', actions: [], attendees: [], tbc: ['david'] },

    /* Wednesday */
    { id: 'wed-startup-1030', day: 'wed', start: '10:30', end: '10:55', kind: 'session', status: 'tbc',
      title: 'Startup meeting (pending)', short: 'Startup (pending)', venue: 'Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'Requested through the Slush platform. Not yet accepted. Ends five minutes before the meetup.', actions: ['Confirm once the request is accepted'], attendees: ['david'], tbc: ['Acceptance'] },
    { id: 'wed-agentic', day: 'wed', start: '11:00', end: '12:00', kind: 'session', status: 'confirmed',
      title: 'Agentic Infrastructure meetup', short: 'Agentic meetup', venue: 'Partner Pod, Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'You are hosting this with a colleague.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'wed-alfred', day: 'wed', start: '13:00', end: '13:25', kind: 'session', status: 'confirmed',
      title: 'Founder meeting: Alfred', short: 'Alfred', venue: 'Company pod, Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'Booked through the Slush platform.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'wed-open', day: 'wed', start: '13:30', end: '16:30', kind: 'personal', status: 'confirmed',
      title: 'Open for startup meetings', short: 'Open slots', venue: 'Slush', area: 'Slush',
      description: 'Room for six 25-minute meetings. No requests have been sent yet.',
      actions: ['Send meeting requests from the shortlist'], attendees: ['david'], tbc: [] },
    { id: 'wed-startup-1430', day: 'wed', start: '14:30', end: '14:55', kind: 'session', status: 'tbc',
      title: 'Startup meeting (to be confirmed)', short: 'Startup (TBC)', venue: 'Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'Requested through the Slush platform. Not yet accepted. Sits inside the open block for startup meetings.', actions: ['Confirm once the request is accepted'], attendees: ['david'], tbc: ['Acceptance'] },
    { id: 'wed-startup-1500', day: 'wed', start: '15:00', end: '15:25', kind: 'session', status: 'tbc',
      title: 'Startup meeting (provisional)', short: 'Startup (prov.)', venue: 'Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'Requested through the Slush platform. Not yet accepted. Sits inside the open block for startup meetings.', actions: ['Confirm once the request is accepted'], attendees: ['david'], tbc: ['Acceptance'] },
    { id: 'wed-mastercard', day: 'wed', start: '17:00', end: '20:00', kind: 'social', status: 'confirmed',
      title: 'Mastercard Lighthouse', short: 'Mastercard', venue: 'Partner Side Event Wing, Venue 8, Slush', address: 'Messukeskus, Messuaukio 1, Helsinki',
      description: 'Partner side event.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'wed-farouge', day: 'wed', start: '18:00', end: '19:30', kind: 'social', status: 'confirmed',
      title: 'Farouge', short: 'Farouge', venue: 'Farouge', address: 'Yrjönkatu 6, Helsinki',
      description: 'All-welcome team event.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'wed-lp', day: 'wed', start: '19:00', end: '22:00', kind: 'social', status: 'confirmed',
      title: 'L&P drinks', short: 'L&P drinks', venue: 'Gillet',
      description: 'All-welcome event. Needs an Eventbrite registration.',
      actions: ['Register on Eventbrite'], attendees: ['david'], tbc: [] },
    { id: 'wed-beyond', day: 'wed', start: '19:00', end: '22:00', kind: 'social', status: 'tbc',
      title: 'Beyond the Stage', short: 'Beyond the Stage', venue: 'Marga',
      description: 'Hosted by Start2 Group. Runs at the same time as L&P drinks.',
      actions: ['RSVP, or tell Start2 Group you are not coming'], attendees: [], tbc: ['david'] },

    /* Thursday */
    { id: 'thu-agentic', day: 'thu', start: '11:00', end: '12:00', kind: 'session', status: 'confirmed',
      title: 'Agentic Infrastructure meetup', short: 'Agentic meetup', venue: 'Partner Pod, Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'Second day of the meetup, to be confirmed.', actions: ['Confirm it runs on both days'], attendees: ['david'], tbc: [] },
    { id: 'thu-olympus', day: 'thu', start: '13:00', end: '13:25', kind: 'session', status: 'tbc',
      title: 'Founder meeting: Olympus', short: 'Olympus', venue: 'Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'You proposed this time on the Slush platform. Waiting for the founder to accept.',
      actions: ['Check the request was accepted'], attendees: [], tbc: ['david'] },
    { id: 'thu-cyber', day: 'thu', start: '14:00', end: '15:00', kind: 'session', status: 'tbc', timeTbc: true,
      title: 'Cybersecurity Founder Meetup', short: 'Cyber meetup', venue: 'Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'The time is an estimate and needs confirming.', actions: ['Confirm the time'], attendees: ['david'], tbc: [] },
    { id: 'thu-open', day: 'thu', start: '15:30', end: '16:30', kind: 'personal', status: 'confirmed',
      title: 'Open for startup meetings', short: 'Open slots', venue: 'Slush', area: 'Slush',
      description: 'Room for two 25-minute meetings.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'thu-startup-1530', day: 'thu', start: '15:30', end: '15:55', kind: 'session', status: 'tbc',
      title: 'Startup meeting (request sent)', short: 'Startup (sent)', venue: 'Company pod, Slush', address: 'Messukeskus, Messuaukio 1, Helsinki', area: 'Slush',
      description: 'Requested through the Slush platform. Not yet accepted. Sits inside the open block for startup meetings.', actions: ['Confirm once the request is accepted'], attendees: ['david'], tbc: ['Acceptance'] },
    { id: 'thu-wrap', day: 'thu', start: '17:00', end: '19:00', kind: 'social', status: 'confirmed',
      title: 'Frontier Founder Fellows: Slush Wrap', short: 'Slush Wrap', venue: 'Venue in invitation',
      description: 'Fellows wrap-up event.', actions: ['RSVP'], attendees: ['david'], tbc: [] },
    { id: 'thu-seahorse', day: 'thu', start: '19:30', end: null, kind: 'social', status: 'tbc',
      title: 'Dinner at Sea Horse (optional)', short: 'Sea Horse', venue: 'Ravintola Sea Horse', address: 'Kapteeninkatu 11, Helsinki',
      description: 'Optional dinner after the wrap.', actions: [], attendees: [], tbc: ['david'] },

    /* Friday */
    { id: 'fri-checkout', day: 'fri', start: '11:00', end: '11:15', kind: 'personal', status: 'confirmed',
      title: 'Hotel checkout', short: 'Checkout', venue: 'Hotel',
      description: 'Checkout is by 11:00.', actions: [], attendees: ['david'], tbc: [] },
    { id: 'fri-flight', day: 'fri', start: '16:00', end: '19:20', kind: 'personal', status: 'confirmed',
      title: 'Flight AY1385, Helsinki to Dublin', short: 'AY1385', venue: 'Helsinki Airport', address: 'Lentoasemantie 1, Vantaa', area: 'Travel',
      description: 'Departs Helsinki 16:00. Lands Dublin 17:20 local time.', actions: [], attendees: ['david'], tbc: [] }
  ],

  routes: [],
  markers: [],

  issues: [
    { id: 'issue-01', day: 'wed', severity: 'critical', source: 'team', title: 'Wednesday evening clash',
      text: 'Beyond the Stage and L&P drinks both run 19:00 to 22:00, and Farouge overlaps Mastercard Lighthouse. Choose, and tell Start2 Group if you drop Beyond the Stage.' },
    { id: 'issue-02', day: 'tue', severity: 'warning', source: 'team', title: 'Partner Dinner seat',
      text: 'Decide whether you or a colleague takes the Slush Partner Dinner at Sipuli. Cocktail dress.' },
    { id: 'issue-03', day: 'tue', severity: 'check', source: 'team', title: 'Tuesday evening start times',
      text: 'Start times for Fellow Networking and the Partner Dinner are not confirmed. The times shown are placeholders.' },
    { id: 'issue-04', day: 'thu', severity: 'check', source: 'team', title: 'Olympus meeting not yet accepted',
      text: 'The 13:00 Thursday request is waiting for the founder to accept.' },
    { id: 'issue-05', day: 'thu', severity: 'check', source: 'team', title: 'Cybersecurity Founder Meetup time',
      text: 'About 14:00 to 15:00 is an estimate. Confirm on the Slush platform.' },
    { id: 'issue-06', day: 'thu', severity: 'check', source: 'team', title: 'Agentic Infrastructure meetup on both days',
      text: 'It appears on Wednesday and Thursday in the team sheet. Confirm that is right.' },
    { id: 'issue-07', day: 'wed', severity: 'warning', source: 'team', title: 'Outstanding RSVPs',
      text: 'Beyond the Stage, Fellows Slush Wrap, and the Eventbrite registration for L&P drinks.' },
    { id: 'issue-08', day: 'wed', severity: 'warning', source: 'team', title: 'Startup meeting requests',
      text: 'Six slots on Wednesday afternoon and two on Thursday are open. No requests have been sent from the shortlist yet.' }
  ],

  dining: [
    { id: 'dining-1', day: 'Tuesday 17 Nov', time: 'until 23:00', name: 'Sipuli', type: 'Slush Partner Dinner', booking: 'One seat, cocktail dress',
      address: 'Kanavaranta 7, Helsinki', mapQuery: 'Ravintola Sipuli, Helsinki', eventId: 'tue-partner-dinner' },
    { id: 'dining-2', day: 'Thursday 19 Nov', time: 'after 19:00', name: 'Ravintola Sea Horse', type: 'Optional dinner', booking: 'Not booked',
      address: 'Kapteeninkatu 11, Helsinki', mapQuery: 'Ravintola Sea Horse, Kapteeninkatu 11, Helsinki', eventId: 'thu-seahorse' }
  ],

  contacts: []
};

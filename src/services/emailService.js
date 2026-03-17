/**
 * Email Service — queues emails via a Firestore `mailQueue` collection.
 *
 * A Firebase Cloud Function (or any backend listener) should watch this
 * collection and dispatch the emails using SendGrid / Mailgun / etc.
 * The client side simply writes the intent; delivery is handled server-side.
 */
import { db } from '../firebase';
import { addDoc, collection } from 'firebase/firestore';

/**
 * Enqueue a single email for delivery.
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Plain-text body
 * @param {string} params.type - Logical type identifier (e.g. 'organizer_assigned')
 * @param {object} [params.metadata] - Extra contextual data stored for debugging / templates
 */
export async function queueEmail({ to, subject, body, type, metadata = {} }) {
  if (!to || !subject) {
    console.warn('[emailService] queueEmail called without to/subject — skipping', { to, subject, type });
    return;
  }
  try {
    await addDoc(collection(db, 'mailQueue'), {
      to,
      subject,
      body,
      type,
      metadata,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    console.log('[emailService] Email queued successfully:', { to, type });
  } catch (err) {
    console.error('[emailService] Failed to queue email:', err);
    // Non-fatal: email queueing failure should not break the calling action
  }
}

/**
 * Notify an Organizer that they have been assigned to a locality.
 * @param {object} params
 * @param {string} params.email - Organizer's email
 * @param {string} params.displayName - Organizer's display name
 * @param {string} params.localityLabel - Human-readable locality label
 */
export async function notifyOrganizerAssigned({ email, displayName, localityLabel }) {
  const name = displayName || 'Organizer';
  await queueEmail({
    to: email,
    subject: `You've been assigned as Organizer for ${localityLabel}`,
    body: [
      `Hello ${name},`,
      '',
      `You have been assigned as an Organizer for the locality: ${localityLabel}.`,
      '',
      'You can now manage events and members for this locality in the Gatherly platform.',
      '',
      'Best regards,',
      'The Gatherly Team',
    ].join('\n'),
    type: 'organizer_assigned',
    metadata: { localityLabel, displayName: name },
  });
}

/**
 * Notify all locality members that a new event has been created.
 * Members without an email address are silently skipped.
 * @param {object[]} members - Array of user objects (must have .email)
 * @param {string} eventTitle - Title of the new event
 * @param {string} localityLabel - Human-readable locality label
 * @param {string} eventDateTime - ISO string of the event date/time
 */
export async function notifyLocalityMembersOfEvent({ members, eventTitle, localityLabel, eventDateTime }) {
  const dateDisplay = eventDateTime
    ? new Date(eventDateTime).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'TBD';

  // Send in sequence to avoid Firestore batch-write rate limits for large lists
  for (const member of members) {
    if (!member.email) continue;
    const name = member.displayName || member.name || 'Member';
    await queueEmail({
      to: member.email,
      subject: `New event in your area: ${eventTitle}`,
      body: [
        `Hello ${name},`,
        '',
        `A new event has been created in your locality (${localityLabel}):`,
        '',
        `  "${eventTitle}"`,
        `  📅 ${dateDisplay}`,
        '',
        'Log in to Gatherly to view the details and book your spot!',
        '',
        'Best regards,',
        'The Gatherly Team',
      ].join('\n'),
      type: 'event_created',
      metadata: { eventTitle, localityLabel, eventDateTime },
    });
  }
}

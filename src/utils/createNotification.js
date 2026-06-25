import { base44 } from '@/api/base44Client';

/**
 * Centralized helper for creating in-app notifications.
 * Avoids duplicating base44.entities.Notification.create(...) across modules.
 *
 * @param {object} options
 * @param {string} options.type        - Notification type (e.g. 'general', 'shift_swap', 'employee_update')
 * @param {string} options.title       - Notification title
 * @param {string} options.message     - Notification body text
 * @param {string} [options.relatedId] - Optional related entity ID
 * @param {string} [options.category] - Notification category (default: 'system')
 * @param {string[]} [options.targetRoles] - Roles that should receive the notification (default: admin + Manager)
 */
export async function createNotification({
    type,
    title,
    message,
    relatedId,
    category = 'system',
    targetRoles = ['admin', 'Manager']
}) {
    return base44.entities.Notification.create({
        type,
        title,
        message,
        category,
        related_id: relatedId,
        target_roles: targetRoles,
        read_by: []
    });
}
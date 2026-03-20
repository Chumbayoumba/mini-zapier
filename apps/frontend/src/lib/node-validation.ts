/**
 * Client-side validation for workflow node configuration fields.
 * Returns an error message string if invalid, or null if valid.
 */

const URL_REGEX = /^https?:\/\/.+/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_VAR_REGEX = /^\{\{/;

export function validateNodeField(
  nodeType: string,
  fieldKey: string,
  value: string | undefined,
): string | null {
  if (!value || value.trim() === '') return null; // Empty checked separately via required

  const v = value.trim();

  // URL fields
  if (fieldKey === 'url' || fieldKey === 'webhookUrl' || fieldKey === 'baseUrl') {
    if (!URL_REGEX.test(v) && !TEMPLATE_VAR_REGEX.test(v)) {
      return 'URL must start with http:// or https://';
    }
  }

  // JSON fields
  if (['headers', 'body', 'where', 'data'].includes(fieldKey)) {
    if (v.startsWith('{') || v.startsWith('[')) {
      try {
        JSON.parse(v);
      } catch (e: any) {
        return `Invalid JSON: ${e.message?.replace('JSON.parse: ', '') || 'syntax error'}`;
      }
    }
  }

  // Timeout
  if (fieldKey === 'timeout') {
    const num = Number(v);
    if (isNaN(num) || num < 1000 || num > 300000) {
      return 'Timeout must be between 1000ms and 300000ms';
    }
  }

  // Port
  if (fieldKey === 'port' || fieldKey === 'imapPort' || fieldKey === 'smtpPort') {
    const num = Number(v);
    if (isNaN(num) || num < 1 || num > 65535) {
      return 'Port must be between 1 and 65535';
    }
  }

  // Email fields
  if (fieldKey === 'to' || fieldKey === 'from' || fieldKey === 'replyTo') {
    if (!TEMPLATE_VAR_REGEX.test(v)) {
      const emails = v.split(',').map((e) => e.trim());
      for (const email of emails) {
        if (!EMAIL_REGEX.test(email)) {
          return `Invalid email address: "${email}"`;
        }
      }
    }
  }

  // Cron expression
  if (fieldKey === 'cronExpression') {
    const parts = v.split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return 'Invalid cron expression (expected 5-6 fields, e.g. "0 * * * *")';
    }
  }

  // Database limit
  if (fieldKey === 'limit') {
    const num = Number(v);
    if (isNaN(num) || num < 1 || num > 10000) {
      return 'Limit must be between 1 and 10000';
    }
  }

  return null;
}

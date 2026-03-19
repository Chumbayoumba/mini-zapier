import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  TELEGRAM_BOT_TOKEN: Joi.string().optional(),
  IMAP_HOST: Joi.string().optional(),
  IMAP_PORT: Joi.number().default(993),
  IMAP_USER: Joi.string().optional(),
  IMAP_PASSWORD: Joi.string().optional(),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  CREDENTIAL_ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
});

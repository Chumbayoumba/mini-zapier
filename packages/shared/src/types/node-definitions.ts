import type { INodeTypeDefinition, PortDefinition } from './node-registry';

// ── Shared port helpers ──────────────────────────────────────────────

const mainInput: PortDefinition = { name: 'main', displayName: 'Input', type: 'main' };
const mainOutput: PortDefinition = { name: 'main', displayName: 'Output', type: 'main' };

// ── Condition operations (shared by IF / FILTER) ─────────────────────

const CONDITION_OPERATIONS = [
  { name: 'Equals', value: 'equals' },
  { name: 'Not Equals', value: 'not_equals' },
  { name: 'Greater Than', value: 'greater_than' },
  { name: 'Less Than', value: 'less_than' },
  { name: 'Contains', value: 'contains' },
  { name: 'Not Contains', value: 'not_contains' },
  { name: 'Starts With', value: 'starts_with' },
  { name: 'Ends With', value: 'ends_with' },
  { name: 'Is Empty', value: 'is_empty' },
  { name: 'Is Not Empty', value: 'is_not_empty' },
  { name: 'Regex Match', value: 'regex_match' },
  { name: 'Exists', value: 'exists' },
] as const;

// ── Trigger definitions ──────────────────────────────────────────────

const WEBHOOK: INodeTypeDefinition = {
  type: 'WEBHOOK',
  displayName: 'Webhook',
  description: 'Triggered by HTTP request',
  icon: 'webhook',
  color: '#8B5CF6',
  group: 'trigger',
  category: 'Trigger',
  inputs: [],
  outputs: [mainOutput],
  properties: [
    {
      name: 'method',
      displayName: 'HTTP Method',
      type: 'options',
      default: 'POST',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'DELETE', value: 'DELETE' },
      ],
    },
    {
      name: 'path',
      displayName: 'Path',
      type: 'string',
      default: '',
      placeholder: '/my-webhook',
      description: 'Webhook endpoint path',
      required: true,
    },
  ],
  version: 1,
  maxNodes: 1,
};

const CRON: INodeTypeDefinition = {
  type: 'CRON',
  displayName: 'Schedule',
  description: 'Triggered on a schedule',
  icon: 'clock',
  color: '#F59E0B',
  group: 'trigger',
  category: 'Trigger',
  inputs: [],
  outputs: [mainOutput],
  properties: [
    {
      name: 'expression',
      displayName: 'Cron Expression',
      type: 'string',
      default: '0 * * * *',
      description: 'Cron expression for schedule',
      required: true,
    },
  ],
  version: 1,
  maxNodes: 1,
};

const EMAIL_TRIGGER: INodeTypeDefinition = {
  type: 'EMAIL',
  displayName: 'Email',
  description: 'Triggered by incoming email',
  icon: 'mail',
  color: '#EF4444',
  group: 'trigger',
  category: 'Trigger',
  inputs: [],
  outputs: [mainOutput],
  properties: [
    {
      name: 'mailbox',
      displayName: 'Mailbox',
      type: 'string',
      default: 'INBOX',
      description: 'Mailbox to monitor',
    },
  ],
  credentials: ['imap'],
  version: 1,
  maxNodes: 1,
};

const TELEGRAM_TRIGGER: INodeTypeDefinition = {
  type: 'TELEGRAM',
  displayName: 'Telegram Trigger',
  description: 'Triggered by Telegram message',
  icon: 'send',
  color: '#0EA5E9',
  group: 'trigger',
  category: 'Trigger',
  inputs: [],
  outputs: [mainOutput],
  properties: [
    {
      name: 'updateType',
      displayName: 'Update Type',
      type: 'options',
      default: 'message',
      options: [
        { name: 'Message', value: 'message' },
        { name: 'Callback Query', value: 'callback_query' },
        { name: 'Inline Query', value: 'inline_query' },
      ],
    },
  ],
  credentials: ['telegramBot'],
  version: 1,
  maxNodes: 1,
};

const MANUAL_TRIGGER: INodeTypeDefinition = {
  type: 'MANUAL_TRIGGER',
  displayName: 'Manual Trigger',
  description: 'Start workflow manually',
  icon: 'play',
  color: '#22C55E',
  group: 'trigger',
  category: 'Trigger',
  inputs: [],
  outputs: [mainOutput],
  properties: [
    {
      name: 'testData',
      displayName: 'Test Data',
      type: 'json',
      default: '{}',
      description: 'JSON data to use when running manually',
    },
  ],
  version: 1,
  maxNodes: 1,
};

// ── Action definitions ───────────────────────────────────────────────

const HTTP_REQUEST: INodeTypeDefinition = {
  type: 'HTTP_REQUEST',
  displayName: 'HTTP Request',
  description: 'Make an HTTP request',
  icon: 'globe',
  color: '#3B82F6',
  group: 'action',
  category: 'Communication',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'method',
      displayName: 'Method',
      type: 'options',
      default: 'GET',
      required: true,
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
        { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' },
        { name: 'DELETE', value: 'DELETE' },
      ],
    },
    {
      name: 'url',
      displayName: 'URL',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://api.example.com',
    },
    {
      name: 'headers',
      displayName: 'Headers',
      type: 'json',
      default: '{}',
    },
    {
      name: 'body',
      displayName: 'Body',
      type: 'json',
      default: '{}',
      displayOptions: { show: { method: ['POST', 'PUT', 'PATCH'] } },
    },
  ],
  subtitle: '={{$parameter.method}} {{$parameter.url}}',
  version: 1,
};

const SEND_EMAIL: INodeTypeDefinition = {
  type: 'SEND_EMAIL',
  displayName: 'Send Email',
  description: 'Send an email message',
  icon: 'send',
  color: '#10B981',
  group: 'action',
  category: 'Communication',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    { name: 'to', displayName: 'To', type: 'string', default: '', required: true },
    { name: 'subject', displayName: 'Subject', type: 'string', default: '', required: true },
    { name: 'body', displayName: 'Body', type: 'textarea', default: '' },
  ],
  credentials: ['smtp'],
  subtitle: '={{$parameter.to}}',
  version: 1,
};

const TELEGRAM_SEND: INodeTypeDefinition = {
  type: 'TELEGRAM_SEND',
  displayName: 'Telegram',
  description: 'Send Telegram message',
  icon: 'message-circle',
  color: '#0EA5E9',
  group: 'action',
  category: 'Communication',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'sendMessage',
      options: [
        { name: 'Send Message', value: 'sendMessage' },
        { name: 'Send Photo', value: 'sendPhoto' },
        { name: 'Send Document', value: 'sendDocument' },
      ],
    },
    {
      name: 'chatId',
      displayName: 'Chat ID',
      type: 'string',
      default: '',
      required: true,
    },
    {
      name: 'text',
      displayName: 'Text',
      type: 'textarea',
      default: '',
      displayOptions: { show: { operation: ['sendMessage'] } },
    },
  ],
  credentials: ['telegramBot'],
  subtitle: '={{$parameter.operation}}',
  version: 1,
};

const DATABASE: INodeTypeDefinition = {
  type: 'DATABASE',
  displayName: 'Database',
  description: 'Execute database query',
  icon: 'database',
  color: '#F97316',
  group: 'action',
  category: 'Data',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'operation',
      displayName: 'Operation',
      type: 'options',
      default: 'select',
      options: [
        { name: 'Select', value: 'select' },
        { name: 'Insert', value: 'insert' },
        { name: 'Update', value: 'update' },
        { name: 'Delete', value: 'delete' },
        { name: 'Raw Query', value: 'raw' },
      ],
    },
    {
      name: 'table',
      displayName: 'Table',
      type: 'string',
      default: '',
      displayOptions: { hide: { operation: ['raw'] } },
    },
    {
      name: 'query',
      displayName: 'Query',
      type: 'textarea',
      default: '',
      displayOptions: { show: { operation: ['raw'] } },
    },
  ],
  credentials: ['database'],
  subtitle: '={{$parameter.operation}}',
  version: 1,
};

const TRANSFORM: INodeTypeDefinition = {
  type: 'TRANSFORM',
  displayName: 'Transform',
  description: 'Transform data with JSONata',
  icon: 'shuffle',
  color: '#6366F1',
  group: 'action',
  category: 'Data',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'expression',
      displayName: 'Expression',
      type: 'code',
      default: '$',
      description: 'JSONata expression',
      typeOptions: { language: 'jsonata' },
    },
  ],
  subtitle: 'JSONata',
  version: 1,
};

// ── Logic definitions ────────────────────────────────────────────────

const IF: INodeTypeDefinition = {
  type: 'IF',
  displayName: 'If',
  description: 'Route items based on conditions',
  icon: 'git-branch',
  color: '#EC4899',
  group: 'logic',
  category: 'Flow',
  inputs: [mainInput],
  outputs: [
    { name: 'true', displayName: 'True', type: 'main' },
    { name: 'false', displayName: 'False', type: 'main' },
  ],
  properties: [
    {
      name: 'conditions',
      displayName: 'Conditions',
      type: 'fixedCollection',
      default: {},
      description: 'Conditions to evaluate',
      typeOptions: {
        multipleValues: true,
        sortable: true,
      },
      options: [
        {
          name: 'condition',
          value: {
            fields: [
              { name: 'value1', displayName: 'Value 1', type: 'string', default: '' },
              {
                name: 'operation',
                displayName: 'Operation',
                type: 'options',
                default: 'equals',
                options: [...CONDITION_OPERATIONS],
              },
              { name: 'value2', displayName: 'Value 2', type: 'string', default: '' },
            ],
          },
        },
      ],
    },
    {
      name: 'combinator',
      displayName: 'Combinator',
      type: 'options',
      default: 'AND',
      description: 'How to combine multiple conditions',
      options: [
        { name: 'AND — all must be true', value: 'AND' },
        { name: 'OR — any must be true', value: 'OR' },
      ],
    },
  ],
  version: 1,
};

const SWITCH: INodeTypeDefinition = {
  type: 'SWITCH',
  displayName: 'Switch',
  description: 'Route items to different outputs based on value',
  icon: 'route',
  color: '#A855F7',
  group: 'logic',
  category: 'Flow',
  inputs: [mainInput],
  outputs: [
    { name: 'output-0', displayName: 'Output 0', type: 'main' },
    { name: 'output-1', displayName: 'Output 1', type: 'main' },
    { name: 'output-2', displayName: 'Output 2', type: 'main' },
    { name: 'output-3', displayName: 'Output 3', type: 'main' },
  ],
  dynamicOutputs: true,
  properties: [
    {
      name: 'field',
      displayName: 'Value to Check',
      type: 'string',
      default: '',
      required: true,
      placeholder: '={{$json.status}}',
      description: 'The value to compare against rules',
    },
    {
      name: 'rules',
      displayName: 'Rules',
      type: 'fixedCollection',
      default: {},
      description: 'Routing rules',
      typeOptions: { multipleValues: true, sortable: true },
      options: [
        {
          name: 'rule',
          value: {
            fields: [
              { name: 'value', displayName: 'Value', type: 'string', default: '' },
              { name: 'outputIndex', displayName: 'Output Index', type: 'number', default: 0 },
            ],
          },
        },
      ],
    },
    {
      name: 'fallbackOutput',
      displayName: 'Fallback Output',
      type: 'number',
      default: 3,
      description: 'Output index when no rule matches',
    },
  ],
  version: 1,
};

const FILTER: INodeTypeDefinition = {
  type: 'FILTER',
  displayName: 'Filter',
  description: 'Filter items based on conditions',
  icon: 'filter',
  color: '#14B8A6',
  group: 'logic',
  category: 'Flow',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'conditions',
      displayName: 'Conditions',
      type: 'fixedCollection',
      default: {},
      description: 'Conditions to evaluate. Items passing all conditions are kept.',
      typeOptions: { multipleValues: true, sortable: true },
      options: [
        {
          name: 'condition',
          value: {
            fields: [
              { name: 'value1', displayName: 'Value 1', type: 'string', default: '' },
              {
                name: 'operation',
                displayName: 'Operation',
                type: 'options',
                default: 'equals',
                options: [...CONDITION_OPERATIONS],
              },
              { name: 'value2', displayName: 'Value 2', type: 'string', default: '' },
            ],
          },
        },
      ],
    },
    {
      name: 'combinator',
      displayName: 'Combinator',
      type: 'options',
      default: 'AND',
      options: [
        { name: 'AND — all must be true', value: 'AND' },
        { name: 'OR — any must be true', value: 'OR' },
      ],
    },
  ],
  version: 1,
};

// ── Utility / transform definitions ──────────────────────────────────

const SET: INodeTypeDefinition = {
  type: 'SET',
  displayName: 'Set',
  description: 'Set, modify or remove item fields',
  icon: 'variable',
  color: '#F97316',
  group: 'transform',
  category: 'Data',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      default: 'set',
      options: [
        { name: 'Set', value: 'set' },
        { name: 'Append', value: 'append' },
        { name: 'Remove', value: 'remove' },
      ],
    },
    {
      name: 'fields',
      displayName: 'Fields',
      type: 'fixedCollection',
      default: {},
      description: 'Fields to set/modify/remove',
      typeOptions: { multipleValues: true },
      options: [
        {
          name: 'field',
          value: {
            fields: [
              { name: 'name', displayName: 'Field Name', type: 'string', default: '' },
              {
                name: 'value',
                displayName: 'Value',
                type: 'string',
                default: '',
                displayOptions: { hide: { '/mode': ['remove'] } },
              },
            ],
          },
        },
      ],
    },
  ],
  subtitle: '={{$parameter.mode}}',
  version: 1,
};

const CODE: INodeTypeDefinition = {
  type: 'CODE',
  displayName: 'Code',
  description: 'Run custom JavaScript code',
  icon: 'code',
  color: '#64748B',
  group: 'transform',
  category: 'Developer',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'language',
      displayName: 'Language',
      type: 'options',
      default: 'javascript',
      options: [{ name: 'JavaScript', value: 'javascript' }],
    },
    {
      name: 'code',
      displayName: 'Code',
      type: 'code',
      default: '// Access input items via $input.all()\n// Return an array of items\nreturn $input.all();',
      typeOptions: { language: 'javascript', rows: 10 },
    },
  ],
  version: 1,
};

const MERGE: INodeTypeDefinition = {
  type: 'MERGE',
  displayName: 'Merge',
  description: 'Merge data from two inputs',
  icon: 'merge',
  color: '#06B6D4',
  group: 'utility',
  category: 'Flow',
  inputs: [
    { name: 'input-0', displayName: 'Input 1', type: 'main' },
    { name: 'input-1', displayName: 'Input 2', type: 'main' },
  ],
  outputs: [mainOutput],
  properties: [
    {
      name: 'mode',
      displayName: 'Mode',
      type: 'options',
      default: 'append',
      options: [
        { name: 'Append', value: 'append' },
        { name: 'Merge By Key', value: 'mergeByKey' },
        { name: 'Keep Matching', value: 'keepMatching' },
        { name: 'Remove Matching', value: 'removeMatching' },
      ],
    },
    {
      name: 'joinField',
      displayName: 'Join Field',
      type: 'string',
      default: 'id',
      description: 'Field name to join on',
      displayOptions: { show: { mode: ['mergeByKey', 'keepMatching', 'removeMatching'] } },
    },
  ],
  subtitle: '={{$parameter.mode}}',
  version: 1,
};

const WAIT: INodeTypeDefinition = {
  type: 'WAIT',
  displayName: 'Wait',
  description: 'Pause execution for a specified time',
  icon: 'timer',
  color: '#EAB308',
  group: 'utility',
  category: 'Flow',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'amount',
      displayName: 'Amount',
      type: 'number',
      default: 1,
      required: true,
    },
    {
      name: 'unit',
      displayName: 'Unit',
      type: 'options',
      default: 'seconds',
      options: [
        { name: 'Seconds', value: 'seconds' },
        { name: 'Minutes', value: 'minutes' },
        { name: 'Hours', value: 'hours' },
      ],
    },
  ],
  subtitle: '={{$parameter.amount}} {{$parameter.unit}}',
  version: 1,
};

const LOOP: INodeTypeDefinition = {
  type: 'LOOP',
  displayName: 'Loop',
  description: 'Iterate over items in batches',
  icon: 'repeat',
  color: '#84CC16',
  group: 'utility',
  category: 'Flow',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [
    {
      name: 'batchSize',
      displayName: 'Batch Size',
      type: 'number',
      default: 10,
      description: 'Number of items per batch',
    },
  ],
  subtitle: 'batch={{$parameter.batchSize}}',
  version: 1,
};

const NOOP: INodeTypeDefinition = {
  type: 'NOOP',
  displayName: 'No Operation',
  description: 'Pass-through node — does nothing',
  icon: 'arrow-right',
  color: '#9CA3AF',
  group: 'utility',
  category: 'Utility',
  inputs: [mainInput],
  outputs: [mainOutput],
  properties: [],
  version: 1,
};

// ── Master registry ──────────────────────────────────────────────────

export const NODE_TYPE_DEFINITIONS: Record<string, INodeTypeDefinition> = {
  // Triggers
  WEBHOOK,
  CRON,
  EMAIL: EMAIL_TRIGGER,
  TELEGRAM: TELEGRAM_TRIGGER,
  MANUAL_TRIGGER,
  // Actions
  HTTP_REQUEST,
  SEND_EMAIL,
  TELEGRAM_SEND,
  DATABASE,
  TRANSFORM,
  // Logic
  IF,
  SWITCH,
  FILTER,
  // Transform / utility
  SET,
  CODE,
  MERGE,
  WAIT,
  LOOP,
  NOOP,
};

export const TRIGGER_DEFINITIONS: INodeTypeDefinition[] = [
  WEBHOOK,
  CRON,
  EMAIL_TRIGGER,
  TELEGRAM_TRIGGER,
  MANUAL_TRIGGER,
];

export const ACTION_DEFINITIONS: INodeTypeDefinition[] = [
  HTTP_REQUEST,
  SEND_EMAIL,
  TELEGRAM_SEND,
  DATABASE,
  TRANSFORM,
];

export const LOGIC_DEFINITIONS: INodeTypeDefinition[] = [IF, SWITCH, FILTER];

export const UTILITY_DEFINITIONS: INodeTypeDefinition[] = [SET, CODE, MERGE, WAIT, LOOP, NOOP];

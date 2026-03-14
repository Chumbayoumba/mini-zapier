// BullMQ sandboxed workflow processor
// This file runs in a separate Node.js process for isolation
import { Job } from 'bullmq';

interface WorkflowJobData {
  executionId: string;
  workflowId: string;
  definition: any;
  triggerData: any;
}

export default async function processWorkflow(job: Job<WorkflowJobData>): Promise<any> {
  const { executionId, workflowId, definition, triggerData } = job.data;

  console.log(`[Processor] Starting workflow ${workflowId}, execution ${executionId}`);

  const nodes: any[] = definition.nodes || [];
  const edges: any[] = definition.edges || [];

  // Build adjacency list for topological sort
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const next of adj.get(nodeId) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  const context: Record<string, any> = { trigger: triggerData };
  const results: any[] = [];

  // Execute nodes in topological order (skip trigger nodes)
  for (const nodeId of order) {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) continue;

    const nodeType = node.data?.type || node.type;
    if (['WEBHOOK', 'CRON', 'EMAIL'].includes(nodeType)) {
      context[nodeId] = triggerData;
      continue;
    }

    const stepStart = Date.now();
    try {
      await job.updateProgress({
        step: nodeId,
        nodeName: node.data?.label || nodeId,
        status: 'RUNNING',
      });

      // Simulate action execution — in production this would call the actual action
      const output = await executeAction(nodeType, node.data?.config || {}, context);
      context[nodeId] = output;

      results.push({
        nodeId,
        nodeName: node.data?.label || nodeId,
        nodeType,
        status: 'COMPLETED',
        output,
        duration: Date.now() - stepStart,
      });

      await job.updateProgress({
        step: nodeId,
        nodeName: node.data?.label || nodeId,
        status: 'COMPLETED',
        duration: Date.now() - stepStart,
      });
    } catch (error: any) {
      results.push({
        nodeId,
        nodeName: node.data?.label || nodeId,
        nodeType,
        status: 'FAILED',
        error: error.message,
        duration: Date.now() - stepStart,
      });

      await job.updateProgress({
        step: nodeId,
        nodeName: node.data?.label || nodeId,
        status: 'FAILED',
        error: error.message,
      });

      throw error; // Let BullMQ handle retry
    }
  }

  console.log(`[Processor] Completed workflow ${workflowId}, execution ${executionId}`);
  return { executionId, results };
}

async function executeAction(
  type: string,
  config: Record<string, any>,
  context: Record<string, any>,
): Promise<any> {
  switch (type) {
    case 'HTTP_REQUEST': {
      const { default: axios } = await import('axios');
      const res = await axios({
        method: config.method || 'GET',
        url: config.url,
        headers: config.headers ? JSON.parse(config.headers) : {},
        data: config.body,
        timeout: 30000,
      });
      return { status: res.status, data: res.data, headers: res.headers };
    }

    case 'SEND_EMAIL': {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: config.to,
        subject: config.subject,
        html: config.body,
      });
      return { sent: true, to: config.to };
    }

    case 'TELEGRAM': {
      const { default: axios } = await import('axios');
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const res = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: config.chatId,
        text: config.message,
        parse_mode: 'HTML',
      });
      return { sent: true, messageId: res.data?.result?.message_id };
    }

    case 'DATABASE': {
      return { result: 'DB action executed in sandboxed processor', config };
    }

    case 'TRANSFORM': {
      const jsonata = await import('jsonata');
      const evaluate = (jsonata as any).default || jsonata;
      const expression = evaluate(config.expression);
      const input = config.inputPath ? context[config.inputPath] : context;
      return await expression.evaluate(input);
    }

    default:
      return { warning: `Unknown action type: ${type}` };
  }
}

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@minizapier.com' },
    update: {},
    create: {
      email: 'admin@minizapier.com',
      name: 'Admin',
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@minizapier.com' },
    update: {},
    create: {
      email: 'user@minizapier.com',
      name: 'Demo User',
      passwordHash: await bcrypt.hash('user123', 10),
      role: UserRole.USER,
    },
  });

  // Create sample workflow for demo user
  const workflow = await prisma.workflow.create({
    data: {
      userId: user.id,
      name: 'Sample Webhook → HTTP → Email',
      description: 'A sample workflow that receives a webhook, makes an HTTP request, and sends an email',
      definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'triggerNode',
            position: { x: 250, y: 50 },
            data: {
              label: 'Webhook Trigger',
              type: 'WEBHOOK',
              config: { method: 'POST' },
            },
          },
          {
            id: 'action-1',
            type: 'actionNode',
            position: { x: 250, y: 200 },
            data: {
              label: 'HTTP Request',
              type: 'HTTP_REQUEST',
              config: {
                url: 'https://jsonplaceholder.typicode.com/posts/1',
                method: 'GET',
              },
            },
          },
          {
            id: 'action-2',
            type: 'actionNode',
            position: { x: 250, y: 350 },
            data: {
              label: 'Transform Data',
              type: 'TRANSFORM',
              config: {
                expression: '{ "title": title, "body": body }',
              },
            },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'trigger-1', target: 'action-1' },
          { id: 'e2-3', source: 'action-1', target: 'action-2' },
        ],
      },
      trigger: {
        create: {
          type: 'WEBHOOK',
          config: { method: 'POST' },
        },
      },
    },
  });

  console.log('Seed data created:');
  console.log(`  Admin: ${admin.email}`);
  console.log(`  User: ${user.email}`);
  console.log(`  Sample workflow: ${workflow.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

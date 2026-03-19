import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E tests for FlowForge backend API.
 * Tests auth flow, workflow CRUD, AI node registration, and integrations endpoints.
 *
 * NOTE: Requires running PostgreSQL and Redis (docker-compose up -d).
 * These tests use a real database — run with caution.
 */
describe('FlowForge API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let workflowId: string;

  const testUser = {
    email: `e2e-test-${Date.now()}@flowforge.test`,
    password: 'TestPass123!',
    name: 'E2E Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    // Cleanup test data
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  // ─── Auth ───────────────────────────────────────────────

  describe('Auth', () => {
    it('POST /api/auth/register — should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
      userId = res.body.user.id;
    });

    it('POST /api/auth/register — should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('POST /api/auth/login — should login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /api/auth/login — should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPass' })
        .expect(401);
    });

    it('GET /api/auth/me — should return current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });

    it('POST /api/auth/refresh — should refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  // ─── Workflows CRUD ─────────────────────────────────────

  describe('Workflows', () => {
    it('POST /api/workflows — should create a workflow', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'E2E Test Workflow',
          description: 'Created by E2E test',
          definition: {
            nodes: [
              { id: 'trigger-1', type: 'triggerNode', position: { x: 0, y: 0 }, data: { label: 'Webhook', type: 'WEBHOOK', config: {} } },
              { id: 'action-1', type: 'actionNode', position: { x: 300, y: 0 }, data: { label: 'HTTP', type: 'HTTP_REQUEST', config: { url: 'https://httpbin.org/get', method: 'GET' } } },
            ],
            edges: [
              { id: 'e1', source: 'trigger-1', target: 'action-1', type: 'smoothstep' },
            ],
          },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('E2E Test Workflow');
      expect(res.body.status).toBe('DRAFT');
      workflowId = res.body.id;
    });

    it('GET /api/workflows — should list workflows', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.workflows.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/workflows/:id — should get workflow by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(workflowId);
    });

    it('PATCH /api/workflows/:id — should update workflow', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated E2E Workflow' })
        .expect(200);

      expect(res.body.name).toBe('Updated E2E Workflow');
    });

    it('POST /api/workflows/:id/activate — should activate workflow', async () => {
      await request(app.getHttpServer())
        .post(`/api/workflows/${workflowId}/activate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });

    it('POST /api/workflows/:id/deactivate — should deactivate workflow', async () => {
      await request(app.getHttpServer())
        .post(`/api/workflows/${workflowId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });

    it('POST /api/workflows/:id/execute — should execute workflow', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ test: true })
        .expect(201);

      expect(res.body.executionId).toBeDefined();
    });

    it('POST /api/workflows/:id/test-node — should test a single node', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/workflows/${workflowId}/test-node`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nodeId: 'trigger-1', inputData: { test: true } })
        .expect(201);

      expect(res.body).toBeDefined();
    });

    it('GET /api/workflows/:id/versions — should get versions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/workflows/${workflowId}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── Executions ─────────────────────────────────────────

  describe('Executions', () => {
    it('GET /api/executions — should list executions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/executions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('GET /api/executions/stats — should return stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/executions/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.totalExecutions).toBeDefined();
    });

    it('GET /api/executions/chart — should return chart data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/executions/chart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── Integrations ───────────────────────────────────────

  describe('Integrations', () => {
    it('GET /api/integrations — should list integrations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/integrations/openrouter/models — should require apiKey', async () => {
      await request(app.getHttpServer())
        .get('/api/integrations/openrouter/models')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  // ─── Notifications ──────────────────────────────────────

  describe('Notifications', () => {
    it('GET /api/notifications — should list notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('GET /api/notifications/unread-count — should return count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(typeof res.body.count).toBe('number');
    });
  });

  // ─── Health ─────────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/health — should return ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });

  // ─── Cleanup ────────────────────────────────────────────

  describe('Cleanup', () => {
    it('DELETE /api/workflows/:id — should delete workflow', async () => {
      if (workflowId) {
        await request(app.getHttpServer())
          .delete(`/api/workflows/${workflowId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
      }
    });

    it('POST /api/auth/logout — should logout', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });
  });
});

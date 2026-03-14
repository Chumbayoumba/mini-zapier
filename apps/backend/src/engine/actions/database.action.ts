import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionHandler } from '../action-handler.interface';

type DbOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'RAW';

interface DatabaseConfig {
  operation: DbOperation;
  table?: string;
  query?: string;
  params?: any[];
  fields?: Record<string, any>;
  where?: Record<string, any>;
  limit?: number;
  orderBy?: string;
}

@Injectable()
export class DatabaseAction implements ActionHandler {
  readonly type = 'DATABASE';
  private readonly logger = new Logger(DatabaseAction.name);
  private readonly ALLOWED_TABLES = [
    'workflows', 'workflow_versions',
    'triggers', 'workflow_executions', 'execution_step_logs',
  ];

  private static readonly SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  constructor(private prisma: PrismaService) {}

  async execute(config: DatabaseConfig): Promise<any> {
    const { operation = 'RAW' } = config;

    this.logger.log(`Executing DB ${operation} operation`);

    if (operation !== 'SELECT') {
      throw new BadRequestException(
        'Only SELECT operations are allowed for security. Use the API for data mutations.',
      );
    }

    return this.executeSelect(config);
  }

  private validateTable(table?: string): asserts table is string {
    if (!table) throw new BadRequestException('Table name is required');
    if (!DatabaseAction.SAFE_IDENTIFIER.test(table)) {
      throw new BadRequestException(`Invalid table name: '${table}'`);
    }
    if (!this.ALLOWED_TABLES.includes(table)) {
      throw new BadRequestException(`Table '${table}' is not allowed`);
    }
  }

  private validateColumnName(column: string): void {
    if (!DatabaseAction.SAFE_IDENTIFIER.test(column)) {
      throw new BadRequestException(`Invalid column name: '${column}'`);
    }
  }

  private buildWhereClause(where?: Record<string, any>, paramOffset = 0): { clause: string; params: any[] } {
    if (!where || Object.keys(where).length === 0) return { clause: '', params: [] };
    const keys = Object.keys(where);
    keys.forEach((k) => this.validateColumnName(k));
    const clause = keys.map((k, i) => `"${k}" = $${paramOffset + i + 1}`).join(' AND ');
    return { clause: `WHERE ${clause}`, params: keys.map((k) => where[k]) };
  }

  private async executeSelect(config: DatabaseConfig) {
    this.validateTable(config.table);
    const { clause, params } = this.buildWhereClause(config.where);
    const limit = config.limit ? `LIMIT ${Number(config.limit)}` : '';
    let orderBy = '';
    if (config.orderBy) {
      this.validateColumnName(config.orderBy);
      orderBy = `ORDER BY "${config.orderBy}"`;
    }
    const sql = `SELECT * FROM "${config.table}" ${clause} ${orderBy} ${limit}`;
    const result = await this.prisma.$queryRawUnsafe(sql, ...params);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
  }
}

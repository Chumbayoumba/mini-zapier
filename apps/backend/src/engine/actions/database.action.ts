import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
export class DatabaseAction {
  private readonly logger = new Logger(DatabaseAction.name);
  private readonly ALLOWED_TABLES = [
    'users', 'workflows', 'workflow_versions',
    'triggers', 'workflow_executions', 'execution_step_logs',
  ];

  constructor(private prisma: PrismaService) {}

  async execute(config: DatabaseConfig): Promise<any> {
    const { operation = 'RAW' } = config;

    this.logger.log(`Executing DB ${operation} operation`);

    switch (operation) {
      case 'SELECT':
        return this.executeSelect(config);
      case 'INSERT':
        return this.executeInsert(config);
      case 'UPDATE':
        return this.executeUpdate(config);
      case 'DELETE':
        return this.executeDelete(config);
      case 'RAW':
        return this.executeRaw(config);
      default:
        throw new BadRequestException(`Unknown DB operation: ${operation}`);
    }
  }

  private validateTable(table?: string) {
    if (!table) throw new BadRequestException('Table name is required');
    if (!this.ALLOWED_TABLES.includes(table)) {
      throw new BadRequestException(`Table '${table}' is not allowed`);
    }
  }

  private buildWhereClause(where?: Record<string, any>): { clause: string; params: any[] } {
    if (!where || Object.keys(where).length === 0) return { clause: '', params: [] };
    const keys = Object.keys(where);
    const clause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(' AND ');
    return { clause: `WHERE ${clause}`, params: keys.map((k) => where[k]) };
  }

  private async executeSelect(config: DatabaseConfig) {
    this.validateTable(config.table);
    const { clause, params } = this.buildWhereClause(config.where);
    const limit = config.limit ? `LIMIT ${Number(config.limit)}` : '';
    const orderBy = config.orderBy ? `ORDER BY "${config.orderBy}"` : '';
    const sql = `SELECT * FROM "${config.table}" ${clause} ${orderBy} ${limit}`;
    const result = await this.prisma.$queryRawUnsafe(sql, ...params);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
  }

  private async executeInsert(config: DatabaseConfig) {
    this.validateTable(config.table);
    if (!config.fields || Object.keys(config.fields).length === 0) {
      throw new BadRequestException('Fields are required for INSERT');
    }
    const keys = Object.keys(config.fields);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO "${config.table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.prisma.$queryRawUnsafe(sql, ...keys.map((k) => config.fields![k]));
    return { rows: result, rowCount: 1 };
  }

  private async executeUpdate(config: DatabaseConfig) {
    this.validateTable(config.table);
    if (!config.fields) throw new BadRequestException('Fields are required for UPDATE');
    if (!config.where) throw new BadRequestException('WHERE clause is required for UPDATE');
    const fieldKeys = Object.keys(config.fields);
    const setCols = fieldKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const whereKeys = Object.keys(config.where);
    const whereClause = whereKeys.map((k, i) => `"${k}" = $${fieldKeys.length + i + 1}`).join(' AND ');
    const params = [...fieldKeys.map((k) => config.fields![k]), ...whereKeys.map((k) => config.where![k])];
    const sql = `UPDATE "${config.table}" SET ${setCols} WHERE ${whereClause} RETURNING *`;
    const result = await this.prisma.$queryRawUnsafe(sql, ...params);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
  }

  private async executeDelete(config: DatabaseConfig) {
    this.validateTable(config.table);
    if (!config.where) throw new BadRequestException('WHERE clause is required for DELETE');
    const { clause, params } = this.buildWhereClause(config.where);
    const sql = `DELETE FROM "${config.table}" ${clause} RETURNING *`;
    const result = await this.prisma.$queryRawUnsafe(sql, ...params);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
  }

  private async executeRaw(config: DatabaseConfig) {
    if (!config.query) throw new BadRequestException('Query is required for RAW operation');
    const forbidden = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
    const upper = config.query.toUpperCase().trim();
    if (forbidden.some((kw) => upper.startsWith(kw))) {
      throw new BadRequestException(`Forbidden operation in query: ${upper.split(' ')[0]}`);
    }
    const result = await this.prisma.$queryRawUnsafe(config.query, ...(config.params || []));
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import axiosRetry from 'axios-retry';

@Injectable()
export class HttpRequestAction {
  private readonly logger = new Logger(HttpRequestAction.name);

  async execute(config: any): Promise<any> {
    const { url, method = 'GET', headers = {}, body, timeout = 30000, retries = 3 } = config;

    const client = axios.create({ timeout });
    axiosRetry(client, {
      retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500;
      },
    });

    this.logger.log(`HTTP ${method} ${url}`);

    const response = await client({
      method,
      url,
      headers,
      data: body,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    };
  }
}

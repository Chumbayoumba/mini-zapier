import api from '@/lib/api';

export interface IntegrationTestResult {
  success: boolean;
  message: string;
}

export async function testIntegration(
  integrationId: string,
): Promise<IntegrationTestResult> {
  try {
    const res = await api.post(`/integrations/${integrationId}/test`);
    const data = res.data?.data || res.data;
    return {
      success: data?.ok ?? data?.success ?? true,
      message: data?.message || 'Connection successful',
    };
  } catch (error: any) {
    const serverMsg =
      error.response?.data?.message ||
      error.response?.data?.data?.message ||
      error.message ||
      'Connection test failed';
    return {
      success: false,
      message: Array.isArray(serverMsg) ? serverMsg[0] : serverMsg,
    };
  }
}

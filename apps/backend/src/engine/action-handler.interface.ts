export interface MultiOutputResult {
  outputs: Array<any[]>; // outputs[0] = items for output 0, outputs[1] = items for output 1, etc.
}

export function isMultiOutputResult(value: any): value is MultiOutputResult {
  return value && Array.isArray(value?.outputs);
}

export interface ActionHandler {
  readonly type: string;
  readonly isMultiOutput?: boolean;
  execute(input: any, context?: any): Promise<any | MultiOutputResult>;
}

export interface ActionHandler {
  readonly type: string;
  execute(input: any, context?: any): Promise<any>;
}

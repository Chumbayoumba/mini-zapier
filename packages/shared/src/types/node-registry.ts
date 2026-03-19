// Node Registry — type definitions for the universal node system

export interface PortDefinition {
  name: string;
  displayName: string;
  type: 'main';
}

export interface INodeProperty {
  name: string;
  displayName: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'options'
    | 'fixedCollection'
    | 'json'
    | 'code'
    | 'textarea'
    | 'notice';
  default: any;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: Array<{ name: string; value: string | number | boolean | Record<string, any> }>;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
  typeOptions?: Record<string, any>;
}

export type NodeGroup = 'trigger' | 'action' | 'logic' | 'transform' | 'utility';
export type NodeCategory = 'Flow' | 'Communication' | 'Data' | 'Developer' | 'Utility' | 'Trigger';

export interface INodeTypeDefinition {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  group: NodeGroup;
  category: NodeCategory;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  dynamicOutputs?: boolean;
  properties: INodeProperty[];
  credentials?: string[];
  version: number;
  subtitle?: string;
  maxNodes?: number;
}

import { Injectable } from '@nestjs/common';
import { ActionHandler } from '../action-handler.interface';

@Injectable()
export class MergeAction implements ActionHandler {
  readonly type = 'MERGE';

  async execute(config: any): Promise<any> {
    const { mode = 'append', joinField, items = [], secondaryItems = [] } = config;
    const primary = Array.isArray(items) ? items : [items];
    const secondary = Array.isArray(secondaryItems) ? secondaryItems : [secondaryItems];

    switch (mode) {
      case 'mergeByKey':
        if (!joinField) return [...primary, ...secondary];
        return primary.map((item: any) => {
          const match = secondary.find((s: any) => s[joinField] === item[joinField]);
          return match ? { ...item, ...match } : item;
        });
      case 'keepMatching':
        if (!joinField) return primary;
        return primary.filter((item: any) =>
          secondary.some((s: any) => s[joinField] === item[joinField]),
        );
      case 'removeMatching':
        if (!joinField) return primary;
        return primary.filter((item: any) =>
          !secondary.some((s: any) => s[joinField] === item[joinField]),
        );
      case 'append':
      default:
        return [...primary, ...secondary];
    }
  }
}

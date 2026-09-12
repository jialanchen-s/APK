import { Injectable, Logger } from '@nestjs/common';

export interface CapabilityCallResult {
  content?: string;
  [key: string]: any;
}

@Injectable()
export class LocalCapabilityService {
  private readonly logger = new Logger(LocalCapabilityService.name);

  load(instanceId: string) {
    return {
      call: async (action: string, payload: Record<string, any>): Promise<CapabilityCallResult> => {
        this.logger.warn(`CapabilityService stub called: instance=${instanceId}, action=${action}`);
        return { content: '' };
      },
      callStream: async function* (action: string, payload: Record<string, any>) {
        yield { content: '' };
      },
    };
  }
}

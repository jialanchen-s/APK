import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from './contract.service';

const EXPIRED_DAYS = 30;

@Injectable()
export class ContractClearAutomationService {
  private readonly logger = new Logger(ContractClearAutomationService.name);

  constructor(private readonly contractService: ContractService) {}

  async clearExpiredRejectedBatches() {
    this.logger.log('开始清理驳回超过 30 天的合同归档数据');
    try {
      const deleted = await this.contractService.cleanExpiredRejected(EXPIRED_DAYS);
      const total = Object.values(deleted).reduce((sum: number, cnt: number) => sum + cnt, 0);
      this.logger.log(`清理完成，共删除 ${total} 条：${JSON.stringify(deleted)}`);
    } catch (error) {
      this.logger.error(
        `清理驳回数据失败: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
      throw error;
    }
  }
}

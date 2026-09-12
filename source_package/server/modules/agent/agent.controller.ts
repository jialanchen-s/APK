import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { NeedLogin, Can } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { AgentService } from './agent.service';
import type {
  CreateAgentSessionRequest,
  SendAgentMessageRequest,
  AgentChatRequest,
} from '@shared/api.interface';

@Controller('api/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @NeedLogin()
  @Can('use', 'Agent')
  @Post('sessions')
  async createSession(
    @Req() req: Request,
    @Body() body: CreateAgentSessionRequest,
  ) {
    const { userId } = req.userContext;
    return this.agentService.createSession(userId, body);
  }

  @Get('sessions')
  async listSessions(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ) {
    return this.agentService.listSessions(
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.agentService.getSession(id);
  }

  @NeedLogin()
  @Can('use', 'Agent')
  @Post('sessions/:id/messages')
  async sendMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: SendAgentMessageRequest,
  ) {
    const { userId } = req.userContext;
    return this.agentService.sendMessage(userId, id, body);
  }

  @NeedLogin()
  @Can('use', 'Agent')
  @Post('sessions/:id/actions/:messageId/confirm')
  async confirmAction(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const { userId } = req.userContext;
    return this.agentService.confirmAction(userId, id, messageId);
  }

  @NeedLogin()
  @Can('use', 'Agent')
  @Post('sessions/:id/actions/:messageId/reject')
  async rejectAction(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const { userId } = req.userContext;
    return this.agentService.rejectAction(userId, id, messageId);
  }

  @Get('sessions/:id/context')
  async getContext(@Param('id') id: string) {
    return this.agentService.getContext(id);
  }

  @Get('sessions/:id/task-status')
  async getTaskStatus(@Param('id') id: string) {
    return this.agentService.getTaskStatusForSession(id);
  }

  @NeedLogin()
  @Can('use', 'Agent')
  @Post('sessions/:id/chat')
  async chatWithAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AgentChatRequest,
  ) {
    const { userId } = req.userContext;
    return this.agentService.chatWithAgent(userId, id, body);
  }

  @NeedLogin()
  @Can('use', 'Agent')
  @Delete('sessions/:id')
  async deleteSession(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const { userId } = req.userContext;
    return this.agentService.deleteSession(userId, id);
  }
}

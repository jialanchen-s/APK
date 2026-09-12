import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { NeedLogin, Can } from '@server/common/auth/decorators';
import { AuthorizationService } from '@server/common/auth/authorization.service';

type MemberType = string;
interface MemberMutationData {
  members: Array<{ userId: string; userName?: string }>;
}

@Controller('api/role_manager')
export class RoleManagerController {
  constructor(private readonly authzSDK: AuthorizationService) {}

  @NeedLogin()
  @Can('manage', 'Permission')
  @Get('roles')
  listRoles() {
    return this.authzSDK.roles.list();
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Get('roles/:bizID')
  getRole(@Param('bizID') bizID: string) {
    return this.authzSDK.roles.get(bizID);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Post('roles')
  createRole(@Body() dto: { role: { name: string; description?: string; bizID: string } }) {
    return this.authzSDK.roles.create(dto);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Put('roles/:bizID')
  updateRole(@Param('bizID') bizID: string, @Body() dto: { role: { name?: string; description?: string } }) {
    return this.authzSDK.roles.update(bizID, dto);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Delete('roles/:bizID')
  deleteRole(@Param('bizID') bizID: string) {
    return this.authzSDK.roles.delete(bizID);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Get('roles/:bizID/members')
  listMembers(@Param('bizID') bizID: string, @Query() query: { type?: MemberType; page?: number; pageSize?: number }) {
    return this.authzSDK.members.list(bizID, query);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Post('roles/:bizID/members')
  addMembers(@Param('bizID') bizID: string, @Body() dto: { members: MemberMutationData }) {
    return this.authzSDK.members.add(bizID, dto);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Post('roles/:bizID/members/batch_remove')
  removeMembers(@Param('bizID') bizID: string, @Body() dto: { members: MemberMutationData }) {
    return this.authzSDK.members.remove(bizID, dto);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Delete('roles/:bizID/members')
  clearMembers(@Param('bizID') bizID: string) {
    return this.authzSDK.members.clear(bizID);
  }

  @NeedLogin()
  @Can('manage', 'Permission')
  @Post('search')
  search(@Body() dto: { query: string; filters?: Record<string, unknown>; pageSize?: number; page?: number }) {
    return this.authzSDK.search.search(dto);
  }
}

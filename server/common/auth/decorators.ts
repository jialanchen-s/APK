import { SetMetadata, applyDecorators, UseGuards, createParamDecorator } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export function NeedLogin() {
  return applyDecorators(SetMetadata(IS_PUBLIC_KEY, false));
}

export function Can(action: string, subject: string) {
  return applyDecorators(SetMetadata(REQUIRE_PERMISSION_KEY, { action, subject }));
}

export const UserContext = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.userContext;
});

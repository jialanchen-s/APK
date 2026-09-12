import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userContext: {
        userId: string;
        userName: string;
      };
    }
  }
}

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req.userContext = {
      userId: 'dev-user-001',
      userName: '开发者',
    };
    next();
  }
}

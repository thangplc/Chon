import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const assertion = await this.authService.verifyBearerToken(
      request.headers.authorization,
    );
    const user = await this.authService.resolveUser(assertion);
    (request as { authUser?: typeof user }).authUser = user;
    return true;
  }
}

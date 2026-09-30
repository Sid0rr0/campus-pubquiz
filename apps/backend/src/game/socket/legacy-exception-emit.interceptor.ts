import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Socket } from 'socket.io';
import { map, type Observable } from 'rxjs';
import type { AckResult } from '@campus-pubquiz/types';

/**
 * Legacy untagged rejection event. Nest's exception filter used to emit it
 * for a thrown WsException; it stays until the frontend reads the
 * acknowledgement instead.
 */
export const LEGACY_EXCEPTION_EVENT = 'exception';

/**
 * Transitional: re-emits every rejected acknowledgement to the sender as the
 * legacy "exception" event so today's frontend behaves exactly as before.
 * Lives outside the handler methods on purpose — specs call those directly
 * and assert nothing was emitted.
 */
@Injectable()
export class LegacyExceptionEmitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const client = context.switchToWs().getClient<Socket>();
    return next.handle().pipe(
      map((result: AckResult | undefined) => {
        if (result && !result.success) {
          client.emit(LEGACY_EXCEPTION_EVENT, {
            status: 'error',
            message: result.error,
          });
        }
        return result;
      }),
    );
  }
}

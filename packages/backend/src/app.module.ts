import {
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  FEDIFY_FEDERATION,
  FedifyModule,
  integrateFederation,
} from '@fedify/nestjs';
import { DatabaseModule } from './database/database.module';
import { FederationModule } from './modules/federation/federation.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { MailModule } from './modules/mail/mail.module';
import { MicrobloggingModule } from './modules/microblogging/microblogging.module';
import { InProcessMessageQueue, MemoryKvStore, Federation } from '@fedify/fedify';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    FedifyModule.forRoot({
      // Allow localhost URLs in development
      kv: new MemoryKvStore(),
      queue: new InProcessMessageQueue(),
      origin: process.env.FEDERATION_ORIGIN || 'http://localhost:3000',
    }),
    FederationModule,
    AuthModule,
    UserModule,
    MailModule,
    MicrobloggingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(FEDIFY_FEDERATION) private federation: Federation<unknown>,
  ) { }

  configure(consumer: MiddlewareConsumer) {
    const fedifyMiddleware = integrateFederation(
      this.federation,
      async (req, res) => {
        // Create rich context with database access and request info
        return {
          request: req,
          response: res,
          url: new URL(req.url, `${req.protocol}://${req.get('host')}`),
        };
      },
    );

    // Apply middleware to all routes except auth endpoints
    consumer
      .apply(fedifyMiddleware)
      .exclude(
        'auth/magic-link',
        'auth/verify',
        'auth/me',
        'auth/logout',
        'health',
        'notes',
        'notes/:id',
        'timeline/home',
        'timeline/public',
        'users/:username/notes',
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

import {
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { ApiEnvironment } from "../config/api-environment";
import { DATABASE, PG_POOL } from "./database.constants";
import * as schema from "./schema";

export type ChonDatabase = NodePgDatabase<typeof schema>;

@Injectable()
class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  exports: [DATABASE, PG_POOL],
  providers: [
    {
      inject: [ConfigService],
      provide: PG_POOL,
      useFactory: (config: ConfigService<ApiEnvironment, true>) =>
        new Pool({
          application_name: "chon-api",
          connectionTimeoutMillis: 5_000,
          database: config.get("DATABASE_NAME", { infer: true }),
          host: config.get("DATABASE_HOST", { infer: true }),
          idleTimeoutMillis: 30_000,
          max: config.get("DATABASE_POOL_MAX", { infer: true }),
          options: `-c search_path=${config.get("DATABASE_SCHEMA", { infer: true })}`,
          password: config.get("DATABASE_PASSWORD", { infer: true }),
          port: config.get("DATABASE_PORT", { infer: true }),
          ssl:
            config.get("DATABASE_SSL", { infer: true }) === "true"
              ? { rejectUnauthorized: true }
              : undefined,
          user: config.get("DATABASE_USER", { infer: true }),
        }),
    },
    {
      inject: [PG_POOL],
      provide: DATABASE,
      useFactory: (pool: Pool): ChonDatabase =>
        drizzle({ client: pool, schema }),
    },
    DatabaseShutdown,
  ],
})
export class DatabaseModule {}

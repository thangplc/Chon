import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import {
  parseCorsOrigins,
  type ApiEnvironment,
} from "./config/api-environment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<ApiEnvironment, true>);

  app.enableCors({
    credentials: true,
    origin: parseCorsOrigins(config.get("API_CORS_ORIGINS", { infer: true })),
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix("v1");

  const openApiConfig = new DocumentBuilder()
    .setTitle("Chốn API")
    .setDescription("Backend contract for Chốn web and future clients")
    .setVersion("1.0")
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("docs", app, documentFactory, {
    jsonDocumentUrl: "openapi.json",
  });

  await app.listen(
    config.get("API_PORT", { infer: true }),
    config.get("API_HOST", { infer: true }),
  );
}

void bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow origins defined in ALLOWED_ORIGIN (comma-separated).
  // In production set this to your Vercel URL, e.g.:
  //   ALLOWED_ORIGIN=https://draw-plan.vercel.app
  const rawOrigins = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173,http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0'); // bind to all interfaces (required on Render)
  console.log(`DrawPlan API running on port ${port}`);
}

bootstrap();

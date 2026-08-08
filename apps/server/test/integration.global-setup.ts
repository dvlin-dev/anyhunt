/**
 * [PROVIDES]: One PostgreSQL/Redis Testcontainers environment per integration suite
 * [DEPENDS]: test/helpers/containers
 * [POS]: Vitest integration lifecycle; never exposes generated connection credentials
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { TestContainers } from './helpers/containers';

declare module 'vitest' {
  export interface ProvidedContext {
    integrationDatabaseUrl: string;
    integrationRedisUrl: string;
    integrationDataSecretKey: string;
  }
}

export async function setup(project: TestProject) {
  const colimaSocket = join(homedir(), '.colima', 'default', 'docker.sock');
  if (!process.env.DOCKER_HOST && existsSync(colimaSocket)) {
    process.env.DOCKER_HOST = `unix://${colimaSocket}`;
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE =
      '/var/run/docker.sock';
  }
  const dataSecretKey = Buffer.alloc(32, 7).toString('base64');
  process.env.ANYHUNT_DATA_SECRET_KEY = dataSecretKey;
  await TestContainers.start();
  project.provide('integrationDatabaseUrl', TestContainers.getPostgresUri());
  project.provide('integrationRedisUrl', TestContainers.getRedisUrl());
  project.provide('integrationDataSecretKey', dataSecretKey);

  return async () => {
    await TestContainers.stop();
  };
}

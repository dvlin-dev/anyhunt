import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/main/schema.prisma'),
  'utf8',
);

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, `Expected model ${name} to exist`).not.toBeNull();
  return match?.[1] ?? '';
}

describe('Anyhunt 1.0 Prisma schema contract', () => {
  it('makes every Topic belong to an owner and deletes owned topics with the user', () => {
    const topic = modelBlock('Topic');

    expect(topic).toMatch(/ownerId\s+String/);
    expect(topic).toMatch(
      /owner\s+User\s+@relation\((?:"[^"]+",\s*)?fields:\s*\[ownerId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
  });

  it('enforces the product idempotency keys', () => {
    expect(modelBlock('Subscription')).toMatch(
      /@@unique\(\[userId,\s*topicId\]\)/,
    );
    expect(modelBlock('Run')).toMatch(/runKey\s+String\s+@unique/);
    expect(modelBlock('RunItem')).toMatch(
      /@@unique\(\[runId,\s*canonicalUrlHash\]\)/,
    );
    expect(modelBlock('SkillVersion')).toMatch(
      /@@unique\(\[skillId,\s*contentHash\]\)/,
    );
    expect(modelBlock('Delivery')).toMatch(
      /@@unique\(\[runId,\s*subscriptionId,\s*channel\]\)/,
    );
    expect(modelBlock('TopicReport')).toMatch(
      /@@unique\(\[topicId,\s*reporterUserId\]\)/,
    );
  });

  it('uses explicit cascade policies for user-owned product data', () => {
    const skill = modelBlock('Skill');
    const subscription = modelBlock('Subscription');
    const itemState = modelBlock('UserItemState');
    const report = modelBlock('TopicReport');

    expect(skill).toMatch(
      /owner\s+User\s+@relation\((?:"[^"]+",\s*)?fields:\s*\[ownerId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
    expect(subscription).toMatch(
      /user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
    expect(subscription).toMatch(
      /topic\s+Topic\s+@relation\(fields:\s*\[topicId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
    expect(itemState).toMatch(
      /user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
    expect(report).toMatch(
      /topic\s+Topic\s+@relation\(fields:\s*\[topicId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
    expect(report).toMatch(
      /reporter\s+User\s+@relation\("TopicReporter",\s*fields:\s*\[reporterUserId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
  });
});

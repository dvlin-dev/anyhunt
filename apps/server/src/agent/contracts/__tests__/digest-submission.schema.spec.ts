import { describe, expect, it } from 'vitest';
import { DigestSubmissionSchema } from '../digest-submission.schema';

describe('DigestSubmissionSchema', () => {
  it('accepts a bounded evidence-backed result shape', () => {
    const result = DigestSubmissionSchema.parse({
      narrative: 'The most important changes this week.',
      items: [
        {
          url: 'https://example.com/research',
          title: 'Research update',
          summary: 'A concise summary.',
          selectionReason: 'Directly addresses the Topic goal.',
        },
      ],
    });

    expect(result.items).toHaveLength(1);
  });

  it('requires a reason for an empty successful result', () => {
    expect(DigestSubmissionSchema.safeParse({ items: [] }).success).toBe(
      false,
    );
    expect(
      DigestSubmissionSchema.safeParse({
        items: [],
        emptyReason: 'No qualifying evidence was found.',
      }).success,
    ).toBe(true);
  });

  it('rejects non-HTTP URLs, unbounded items, and unknown fields', () => {
    const item = {
      url: 'https://example.com/item',
      title: 'Title',
      summary: 'Summary',
      selectionReason: 'Relevant.',
    };

    expect(
      DigestSubmissionSchema.safeParse({
        items: [{ ...item, url: 'file:///etc/passwd' }],
      }).success,
    ).toBe(false);
    expect(
      DigestSubmissionSchema.safeParse({
        items: Array.from({ length: 51 }, () => item),
      }).success,
    ).toBe(false);
    expect(
      DigestSubmissionSchema.safeParse({ items: [item], workflow: 'hidden' })
        .success,
    ).toBe(false);
  });
});

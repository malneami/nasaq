import { CsvAdapter } from '@/lib/finance/adapters/csv';
import { ManualAdapter } from '@/lib/finance/adapters/manual';
import { SmsAdapter } from '@/lib/finance/adapters/sms';
import type { IngestAdapter, IngestAdapterName } from '@/lib/finance/types';

export { CsvAdapter, ManualAdapter, SmsAdapter };

export function getAdapter(name: IngestAdapterName): IngestAdapter {
  switch (name) {
    case 'manual':
      return new ManualAdapter();
    case 'csv':
      return new CsvAdapter();
    case 'sms':
      return new SmsAdapter();
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown adapter: ${exhaustive}`);
    }
  }
}

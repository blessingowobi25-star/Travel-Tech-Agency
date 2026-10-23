import { loadEnvFile } from './load-env';
import { migrate } from '../src/db/migrate';
import { resetDb } from '../src/db/client';
import {
  destinationFacets,
  listDestinations,
  getDestinationBySlug,
} from '../src/repositories/destinations';
import { findUserByEmail, authenticate } from '../src/lib/auth/service';
import { listEnquiries } from '../src/repositories/enquiries';
import { listQuotesByUser } from '../src/repositories/quotes';
import { listOrdersByUser } from '../src/repositories/orders';

loadEnvFile();

/**
 * Smoke test: reads the seeded database back through the repository layer and
 * asserts that the demo content is present and usable.
 */
let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`, detail ?? '');
  }
}

async function main() {
  await migrate();

  console.log('\nDestinations');
  const all = await listDestinations({ includeUnpublished: true, limit: 100 });
  const published = await listDestinations({ limit: 100 });
  check('12 destinations exist', all.length === 12, `got ${all.length}`);
  check('all are published', published.length === 12, `got ${published.length}`);
  check(
    'all are marked unverified',
    all.every((d) => d.dataConfidence === 'unverified'),
  );
  check(
    'all are draft review status',
    all.every((d) => d.reviewStatus === 'draft'),
  );
  check(
    'slugs are unique',
    new Set(all.map((d) => d.slug)).size === all.length,
  );
  check(
    'budgets are populated and sane',
    all.every(
      (d) =>
        d.budgetMin > 0 &&
        d.budgetMax > d.budgetMin &&
        d.budgetCurrency === 'NGN',
    ),
  );
  check(
    'durations are sane',
    all.every((d) => d.durationMinDays > 0 && d.durationMaxDays >= d.durationMinDays),
  );

  const bonny = await getDestinationBySlug('bonny-island-edo');
  check('Bonny Island slug is correct', bonny?.name === 'Bonny Island');
  check('the old typo slug is gone', (await getDestinationBySlug('bonnary-edo')) === null);

  console.log('\nFacets');
  const facets = await destinationFacets();
  check('countries resolved', facets.countries.length === 1, facets.countries);
  check('moods resolved', facets.moods.length > 0);
  check('interests resolved', facets.interests.length > 0);
  check('cost categories resolved', facets.costCategories.length > 0);

  console.log('\nFilters');
  const cheap = await listDestinations({ costCategory: 'budget', limit: 100 });
  check('cost filter works', cheap.length > 0 && cheap.every((d) => d.costCategory === 'budget'));
  const searched = await listDestinations({ search: 'lagos', limit: 100 });
  check('search works', searched.length > 0, searched.map((d) => d.slug));

  console.log('\nUsers');
  for (const email of [
    'admin@waymark.test',
    'agent@waymark.test',
    'customer@waymark.test',
  ]) {
    const user = await findUserByEmail(email);
    check(`${email} exists`, user !== null);
  }

  const admin = await findUserByEmail('admin@waymark.test');
  check('admin role assigned', admin?.role === 'admin');
  const agent = await findUserByEmail('agent@waymark.test');
  check('agent role assigned', agent?.role === 'agent');
  const customer = await findUserByEmail('customer@waymark.test');
  check('customer role assigned', customer?.role === 'customer');

  const signedIn = await authenticate('customer@waymark.test', 'Waymark123!');
  check('demo password authenticates', signedIn?.email === 'customer@waymark.test');
  const wrong = await authenticate('customer@waymark.test', 'wrong-password');
  check('wrong password is rejected', wrong === null);

  console.log('\nDemo journey');
  if (!customer) throw new Error('demo customer missing');
  const enquiries = await listEnquiries({ userId: customer.id });
  check('one enquiry exists', enquiries.length === 1, `got ${enquiries.length}`);
  check('enquiry has a reference', Boolean(enquiries[0]?.reference));
  check('enquiry is linked to Lagos', Boolean(enquiries[0]?.destinationId));

  const quotes = await listQuotesByUser(customer.id);
  check('one quote exists', quotes.length === 1, `got ${quotes.length}`);
  check('quote has items', (quotes[0]?.items.length ?? 0) === 4);
  check('quote subtotal matches items', (() => {
    const quote = quotes[0];
    if (!quote) return false;
    const sum = quote.items.reduce((total, item) => total + item.amount, 0);
    return Math.abs(sum - quote.subtotal) < 0.01;
  })());
  check('quote total equals subtotal + fees', (() => {
    const quote = quotes[0];
    if (!quote) return false;
    return Math.abs(quote.subtotal + quote.fees - quote.total) < 0.01;
  })());
  check('quote total is 165000', quotes[0]?.total === 165000, quotes[0]?.total);

  const orders = await listOrdersByUser(customer.id);
  check('one order exists', orders.length === 1, `got ${orders.length}`);
  check('order is awaiting payment', orders[0]?.status === 'AWAITING_PAYMENT');
  check('order is payable', orders[0]?.payable === true);
  check('order carries the items', (orders[0]?.items.length ?? 0) === 4);
  check('order total matches the quote', orders[0]?.total === quotes[0]?.total);

  console.log(
    failures === 0
      ? '\nAll checks passed.'
      : `\n${failures} check(s) failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Smoke test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await resetDb();
  });

export async function createEnquiryAction(
  userId: string | null,
  service: string,
  contactName: string,
  contactEmail: string,
  contactPhone?: string | null,
  partySize?: number | null,
  departureCity?: string | null,
  travelStartDate?: string | null,
  flexibility?: string | null,
  budgetAmount?: number | null,
  budgetCurrency?: string,
  details: string = '',
  destinationId?: string | null
) {
  'use server';
  const { createEnquiry } = await import('@/repositories/enquiries');
  await createEnquiry({
    userId,
    service,
    contactName,
    contactEmail,
    contactPhone,
    partySize,
    departureCity,
    travelStartDate,
    flexibility,
    budgetAmount,
    budgetCurrency,
    details,
    destinationId,
  });
  return { success: true };
}
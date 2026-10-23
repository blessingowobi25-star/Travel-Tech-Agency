'use server';

import { recordPaymentEvent } from '@/lib/payments/service';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    const { eventId, reference, eventType, status, amount, currency } = payload;
    
    if (!eventId || !reference || !eventType || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const recorded = await recordPaymentEvent({
      eventId,
      reference,
      eventType,
      status,
      amount,
      currency,
      payload: payload,
    });
    
    if (!recorded) {
      return new Response(
        JSON.stringify({ error: 'Event already processed' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true, recorded }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
'use server';

import { initiatePaymentAction } from '@/actions/payments';
import { getOrderById } from '@/repositories/orders';
import { getCurrentUser } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { orderId, email, callbackUrl } = await request.json();
    
    const order = await getOrderById(orderId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await initiatePaymentAction(orderId, email, callbackUrl);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
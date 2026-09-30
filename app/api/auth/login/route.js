import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const callbackUrl = process.env.CALLBACK_URL;
  
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}`;
  return NextResponse.redirect(url);
}
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: "Authorization code tidak ditemukan" }, { status: 400 });
  }

  // 1. Tukar code dengan Access Token GitHub
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 
      'Accept': 'application/json', 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    })
  });
  const { access_token } = await tokenRes.json();

  // 2. Ambil data profil GitHub
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const githubUser = await userRes.json();

  // 3. Terbitkan JWT dari server Anda sendiri
  const token = jwt.sign(
    { username: githubUser.login }, 
    process.env.JWT_SECRET, 
    { expiresIn: '1h' }
  );

  return NextResponse.json({ 
    message: "Login berhasil! Salin token di bawah ini untuk Apollo Sandbox", 
    token 
  });
}
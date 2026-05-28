'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useForgotPasswordMutation } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [forgotPassword, { isLoading, isSuccess }] = useForgotPasswordMutation();
  const [error, setError] = useState<string | null>(null);

  const isFormValid = useMemo(() => email && !isLoading, [email, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await forgotPassword({ email }).unwrap();
      toast.success(response.message || 'Password reset link sent to your email.');
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message || 'Failed to send reset link';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-5 sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Forgot Password</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Enter your registered email address to receive a reset link
            </p>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              <p className="text-sm font-medium">{error}</p>
            </Alert>
          )}

          {isSuccess && (
            <Alert
              variant="success"
              className="mb-4 bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400"
            >
              <p className="text-sm font-medium">Password reset link sent to your email.</p>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-semibold">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <Button type="submit" className="w-full mt-6" disabled={!isFormValid}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Back to Login
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useResetPasswordMutation } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [error, setError] = useState<string | null>(null);

  const passwordValidation = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return 'Password must be at least 6 characters long.';
    return null;
  }, [password]);

  const matchError = useMemo(() => {
    if (!confirmPassword) return null;
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }, [password, confirmPassword]);

  const isFormValid = useMemo(
    () => password && confirmPassword && !passwordValidation && !matchError && !isLoading && token,
    [password, confirmPassword, passwordValidation, matchError, isLoading, token],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      toast.error('Invalid reset link.');
      return;
    }

    try {
      const response = await resetPassword({ token, password }).unwrap();
      toast.success(response.message || 'Password reset successfully. Please log in.');
      router.push('/login');
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message || 'Failed to reset password';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-5 sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Reset Password</h1>
            <p className="text-slate-600 dark:text-slate-400">Enter your new password below</p>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              <p className="text-sm font-medium">{error}</p>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
              {passwordValidation && <p className="mt-1 text-xs text-red-500">{passwordValidation}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
              />
              {matchError && <p className="mt-1 text-xs text-red-500">{matchError}</p>}
            </div>

            <Button type="submit" className="w-full mt-6" disabled={!isFormValid}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
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

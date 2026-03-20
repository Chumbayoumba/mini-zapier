'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, AlertCircle } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const login = useLogin();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: LoginForm) => {
    setServerError(null);
    login.mutate(data, {
      onError: (error: any) => {
        const msg = error?.response?.data?.message || 'Invalid email or password';
        setServerError(typeof msg === 'string' ? msg : msg[0] || 'Invalid email or password');
      },
    });
  };

  return (
    <div>
      <a href="/" className="flex items-center justify-center gap-2.5 mb-8 lg:hidden hover:opacity-80 transition-opacity">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">FlowForge</span>
      </a>

      <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/30 dark:border dark:border-white/10">
        <CardHeader className="text-center pb-2 pt-8">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-sm">Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          {sessionExpired && (
            <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 mb-4">
              <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Your session has expired. Please sign in again.</p>
            </div>
          )}

          {serverError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className={`h-10 ${serverError ? 'border-destructive/50' : ''}`}
                onChange={() => setServerError(null)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Forgot password?
                </a>
              </div>
              <Input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className={`h-10 ${serverError ? 'border-destructive/50' : ''}`}
                onChange={() => setServerError(null)}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message as string}</p>}
            </div>
            <Button type="submit" className="w-full h-10 font-semibold" disabled={login.isPending}>
              {login.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or</span></div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium text-primary hover:text-primary/80 transition-colors">
                Create account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

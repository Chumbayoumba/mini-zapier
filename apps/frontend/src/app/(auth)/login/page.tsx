'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2 } from 'lucide-react';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  return (
    <div>
      {/* Brand mark (visible on mobile where sidebar is hidden) */}
      <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">FlowForge</span>
      </div>

      <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/30 dark:border dark:border-white/10">
        <CardHeader className="text-center pb-2 pt-8">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-sm">Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          <form onSubmit={handleSubmit((data) => login.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="h-10"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <button type="button" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Forgot password?
                </button>
              </div>
              <Input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="h-10"
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
